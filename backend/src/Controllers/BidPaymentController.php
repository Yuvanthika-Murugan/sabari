<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Auction;
use App\Models\BidPayment;
use App\Services\Audit;
use App\Services\BidDocuments;
use App\Services\Notifier;
use App\Services\Visibility;

/**
 * Bid (prize) payment to an auction winner:
 *   Apply (office) -> Verify (manager / admin) -> Approval (MD) -> Document (office collects
 *   the surety documents) -> Document Verify (MD) -> Payment Entry (admin / MD pays, booked
 *   in the cash or bank book). Any open step can be rejected with a reason; the MD can send
 *   documents back. A Direct Payment (AuctionController::pay) skips the steps.
 */
final class BidPaymentController
{
    /** Documents that can be ticked at the Document step. */
    public const DOCUMENTS = ['Application form', 'ID proof (Aadhaar)', 'Address proof', 'PAN card', 'Surety / guarantor form',
        'Guarantor ID proof', 'Promissory note', 'Cheque leaves', 'Bank passbook copy', 'Salary / income proof', 'Photos'];

    /** step => [status it needs, status it moves to, roles allowed, timestamp column prefix] */
    private const STEPS = [
        'verify' => ['applied', 'verified', ['md', 'admin', 'manager'], 'verified'],
        'approve' => ['verified', 'approved', ['md'], 'approved'],
        'document' => ['approved', 'documented', ['md', 'admin', 'manager'], 'documented'],
        'docVerify' => ['documented', 'doc_verified', ['md'], 'doc_verified'],
    ];

    public static function visible(): array
    {
        return self::withFiles(Visibility::officeOnly(BidPayment::all()));
    }

    public static function index(Request $req): array
    {
        return self::visible();
    }

    /** Apply: start a payment request for an auction winner whose prize is unpaid. */
    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $auctionId = $in->id('auctionId', true);
        $note = $in->str('note', false, 255);
        $in->validate();

        $auction = Auction::find($auctionId);
        if ($auction['payoutStatus'] === 'paid') {
            throw HttpException::unprocessable('The prize for this bid has already been paid');
        }
        if ($open = BidPayment::openFor($auctionId)) {
            throw HttpException::unprocessable("A bid payment request ($open) is already in progress for this bid");
        }
        $id = DB::transaction(function () use ($auction, $auctionId, $note) {
            $no = BidPayment::nextCode('request_no', 'BP', 5);
            $id = BidPayment::create([
                'request_no' => $no, 'auction_id' => $auctionId, 'type' => 'request', 'status' => 'applied',
                'apply_note' => $note, 'applied_by' => Auth::id(), 'applied_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('Bid Payment Applied', 'Bid Payments', $no, '-', "{$auction['customerName']} · " . Audit::money($auction['prizeAmount']));
            Notifier::push('manager_approval', 'Bid payment to verify', "$no: {$auction['customerName']} ({$auction['groupName']} #{$auction['auctionNo']}) " . Audit::money($auction['prizeAmount']));
            return $id;
        });
        return self::one($id);
    }

    /** Moves a request one step on (verify / approve / document / docVerify), sends documents back, or rejects it. */
    public static function step(Request $req, int $id): array
    {
        $p = BidPayment::find($id);
        $in = $req->input();
        $action = $in->enum('action', [...array_keys(self::STEPS), 'return', 'reject']);
        $note = $in->str('note', in_array($action, ['return', 'reject'], true), 255);
        // The documents collected are the ones with an uploaded scan.
        $documents = $action === 'document'
            ? array_column(DB::all('SELECT DISTINCT document FROM bid_payment_files WHERE bid_payment_id = ? ORDER BY document', [$id]), 'document')
            : [];
        if ($action === 'document' && !$documents) {
            $in->error('documents', 'Upload at least one document');
        }
        $in->validate();

        $now = date('Y-m-d H:i:s');
        if ($action === 'reject') {
            // The office can reject at Apply / Verify; after that only the MD.
            Auth::requireRole(...(in_array($p['status'], ['applied', 'verified'], true) ? ['md', 'admin', 'manager'] : ['md']));
            if (in_array($p['status'], ['paid', 'rejected'], true)) {
                throw HttpException::unprocessable('This request is already ' . $p['status']);
            }
            BidPayment::update($id, ['status' => 'rejected', 'reject_note' => $note, 'rejected_stage' => $p['status'], 'rejected_by' => Auth::id(), 'rejected_at' => $now]);
            Audit::log('Bid Payment Rejected', 'Bid Payments', $p['requestNo'], $p['status'], $note);
            Notifier::push('payment_rejected', 'Bid payment rejected', "{$p['requestNo']}: {$p['customerName']} · $note");
        } elseif ($action === 'return') {
            Auth::requireRole('md');
            if ($p['status'] !== 'documented') {
                throw HttpException::unprocessable('Only documents waiting for verification can be sent back');
            }
            BidPayment::update($id, ['status' => 'approved', 'document_note' => "Returned: $note", 'documented_by' => null, 'documented_at' => null]);
            Audit::log('Bid Documents Returned', 'Bid Payments', $p['requestNo'], 'documented', $note);
            Notifier::push('payment_rejected', 'Bid documents sent back', "{$p['requestNo']}: {$p['customerName']} · $note");
        } else {
            [$from, $to, $roles, $col] = self::STEPS[$action];
            Auth::requireRole(...$roles);
            if ($p['status'] !== $from) {
                throw HttpException::unprocessable("This request is at the '{$p['status']}' step, not '$from'");
            }
            $data = ['status' => $to, "{$col}_by" => Auth::id(), "{$col}_at" => $now];
            if ($action === 'document') {
                $data['documents'] = implode(', ', $documents);
                $data['document_note'] = $note;
            }
            BidPayment::update($id, $data);
            Audit::log('Bid Payment ' . ucfirst($to === 'doc_verified' ? 'documents verified' : $to), 'Bid Payments', $p['requestNo'], $from, $to);
            $next = ['verified' => ['md_approval', 'Bid payment to approve'], 'approved' => ['payment_approved', 'Bid payment approved — collect documents'],
                'documented' => ['md_approval', 'Bid documents to verify'], 'doc_verified' => ['payment_approved', 'Bid payment ready to pay']][$to];
            Notifier::push($next[0], $next[1], "{$p['requestNo']}: {$p['customerName']} " . Audit::money($p['toPay']));
        }
        return self::one($id);
    }

    /** Payment Entry: pay a request whose documents the MD verified. */
    public static function pay(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $p = BidPayment::find($id);
        if ($p['status'] !== 'doc_verified') {
            throw HttpException::unprocessable($p['status'] === 'paid' ? 'This bid payment has already been paid' : 'Only a request whose documents the MD verified can be paid');
        }
        DB::transaction(function () use ($req, $p, $id) {
            [$mode, $accountId, $reference, $date] = AuctionController::payPrize(Auction::find((int) $p['auctionId']), $req->input());
            BidPayment::update($id, [
                'status' => 'paid', 'payout_mode' => $mode, 'bank_account_id' => $accountId,
                'payout_reference' => $reference, 'paid_date' => $date, 'paid_by' => Auth::id(),
            ]);
            Audit::log('Bid Payment Paid', 'Bid Payments', $p['requestNo'], 'doc_verified', Audit::money($p['toPay']) . " ($mode)");
        });
        return self::one($id);
    }

    /** Records a Direct Payment (prize paid without the steps); closes any open request for it. */
    public static function recordDirect(array $auction, array $paid): void
    {
        [$mode, $accountId, $reference, $date] = $paid;
        $now = date('Y-m-d H:i:s');
        $row = ['status' => 'paid', 'payout_mode' => $mode, 'bank_account_id' => $accountId, 'payout_reference' => $reference,
            'paid_date' => $date, 'paid_by' => Auth::id()];
        $openId = DB::value("SELECT id FROM bid_payments WHERE auction_id = ? AND status <> 'rejected' LIMIT 1", [(int) $auction['id']]);
        if ($openId) {
            BidPayment::update((int) $openId, $row);
            return;
        }
        BidPayment::create($row + [
            'request_no' => BidPayment::nextCode('request_no', 'BP', 5), 'auction_id' => (int) $auction['id'], 'type' => 'direct',
            'apply_note' => 'Direct payment', 'applied_by' => Auth::id(), 'applied_at' => $now,
        ]);
    }

    /** Document step: upload one scanned document (image or PDF) while the request waits for documents. */
    public static function upload(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $p = BidPayment::find($id);
        if ($p['status'] !== 'approved') {
            throw HttpException::unprocessable('Documents can be uploaded only after MD approval, before they are submitted');
        }
        $in = $req->input();
        $document = $in->enum('document', self::DOCUMENTS);
        $fileName = $in->str('fileName', true, 160);
        $dataUrl = $req->body['fileData'] ?? '';
        if (!is_string($dataUrl) || $dataUrl === '') {
            $in->error('file', 'Choose a file to upload');
        }
        $in->validate();
        [$stored, $mime, $size] = BidDocuments::store($dataUrl);
        try {
            DB::insert('bid_payment_files', [
                'bid_payment_id' => $id, 'document' => $document, 'file_name' => $fileName, 'stored_name' => $stored,
                'mime' => $mime, 'size_bytes' => $size, 'uploaded_by' => Auth::id(), 'uploaded_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            BidDocuments::delete($stored);
            throw $e;
        }
        Audit::log('Bid Document Uploaded', 'Bid Payments', $p['requestNo'], '-', "$document: $fileName");
        return self::one($id);
    }

    /** Removes an uploaded document while the request still waits for documents. */
    public static function deleteFile(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $file = self::file($id);
        $p = BidPayment::find((int) $file['bid_payment_id']);
        if ($p['status'] !== 'approved') {
            throw HttpException::unprocessable('Documents already submitted to the MD cannot be removed');
        }
        DB::exec('DELETE FROM bid_payment_files WHERE id = ?', [$id]);
        BidDocuments::delete($file['stored_name']);
        Audit::log('Bid Document Removed', 'Bid Payments', $p['requestNo'], "{$file['document']}: {$file['file_name']}", '-');
        return self::one((int) $p['id']);
    }

    /** An uploaded document's content (as a data URL), for office users to view. */
    public static function viewFile(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $file = self::file($id);
        return ['fileName' => $file['file_name'], 'mime' => $file['mime'], 'dataUrl' => BidDocuments::dataUrl($file['stored_name'], $file['mime'])];
    }

    private static function file(int $id): array
    {
        return DB::one('SELECT * FROM bid_payment_files WHERE id = ?', [$id]) ?? throw new HttpException(404, 'File not found');
    }

    private static function one(int $id): array
    {
        return self::withFiles([BidPayment::find($id)])[0];
    }

    /** Adds each request's uploaded documents (without their content) as files[]. */
    private static function withFiles(array $rows): array
    {
        if (!$rows) {
            return $rows;
        }
        $ids = array_map(fn ($r) => (int) $r['id'], $rows);
        $files = DB::all(
            "SELECT CAST(f.id AS CHAR) AS id, f.bid_payment_id AS paymentId, f.document, f.file_name AS fileName, f.mime,
                f.size_bytes AS size, COALESCE(u.name, '-') AS uploadedBy, DATE_FORMAT(f.uploaded_at, '%Y-%m-%d %H:%i') AS uploadedAt
             FROM bid_payment_files f LEFT JOIN users u ON u.id = f.uploaded_by
             WHERE f.bid_payment_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ') ORDER BY f.id',
            $ids,
        );
        $by = [];
        foreach ($files as $f) {
            $pid = (int) $f['paymentId'];
            unset($f['paymentId']);
            $f['size'] = (int) $f['size'];
            $by[$pid][] = $f;
        }
        foreach ($rows as &$r) {
            $r['files'] = $by[(int) $r['id']] ?? [];
        }
        return $rows;
    }
}
