<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Auction;
use App\Models\BankAccount;
use App\Models\ChitGroup;
use App\Models\Customer;
use App\Models\Setting;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Notifier;

/**
 * Chit auctions. The winning subscriber bids a discount (bid amount) on the
 * group value. The foreman keeps the commission out of that discount, the rest
 * is shared as a dividend that reduces every member's dues, and the winner is
 * paid the prize (group value - bid amount).
 */
final class AuctionController
{
    public static function index(Request $req): array
    {
        return Auction::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $groupId = $in->id('groupId', true);
        $customerId = $in->id('customerId', true);
        $auctionNo = $in->int('auctionNo', true, 1);
        $date = $in->date('auctionDate', false, date('Y-m-d'));
        $bid = $in->num('bidAmount', true);
        $remarks = $in->str('remarks');
        $in->validate();

        $group = ChitGroup::record($groupId)
            ?? throw HttpException::unprocessable('Please correct the highlighted fields', ['groupId' => 'Group not found']);
        if ($group['status'] !== 'active') {
            $in->error('groupId', 'Auctions can only be held for active groups');
        }
        if ($auctionNo > (int) $group['duration']) {
            $in->error('auctionNo', "This group has only {$group['duration']} installments");
        } elseif (Auction::installmentTaken($groupId, $auctionNo)) {
            $in->error('auctionNo', 'This installment has already been auctioned');
        }

        $winner = Customer::inGroup($customerId, $groupId);
        if (!$winner || $winner['status'] !== 'active') {
            $in->error('customerId', 'Choose an active subscriber of this group');
        } elseif (Auction::alreadyWon($groupId, $customerId)) {
            $in->error('customerId', 'This subscriber has already won an auction in this group');
        }

        $value = (float) $group['group_value'];
        $commission = round($value * Setting::rate('foremanCommissionPct') / 100, 2);
        $maxBid = round($value * Setting::rate('maxBidPct') / 100, 2);
        if ($bid < $commission) {
            $in->error('bidAmount', 'Bid must be at least the foreman commission of ' . Audit::money($commission));
        } elseif ($bid > $maxBid) {
            $in->error('bidAmount', 'Bid cannot exceed the maximum of ' . Audit::money($maxBid));
        }
        $in->validate();

        return DB::transaction(function () use ($group, $winner, $groupId, $customerId, $auctionNo, $date, $bid, $commission, $value, $remarks) {
            $members = Customer::dividendMembers($groupId);
            $dividend = round($bid - $commission, 2);
            $perMember = $members ? floor($dividend / count($members) * 100) / 100 : 0;

            $code = Auction::nextCode('auction_code', 'AUC', 5);
            $id = Auction::create([
                'auction_code' => $code,
                'group_id' => $groupId,
                'auction_no' => $auctionNo,
                'auction_date' => $date,
                'customer_id' => $customerId,
                'bid_amount' => $bid,
                'commission_amount' => $commission,
                'dividend_amount' => $dividend,
                'dividend_per_member' => $perMember,
                'prize_amount' => $value - $bid,
                'remarks' => $remarks,
                'created_by' => Auth::id(),
            ]);

            foreach ($members as $memberId) {
                Ledger::applyDividend($memberId, $auctionNo, $perMember);
            }

            Notifier::push('md_approval', 'Auction Held', sprintf('%s won auction #%d of %s. Prize %s awaiting payout.', $winner['name'], $auctionNo, $group['group_code'], Audit::money($value - $bid)));
            Audit::log('Auction Held', 'Auctions', $code, '-', sprintf('%s, bid %s', $winner['name'], Audit::money($bid)));
            return Auction::find($id);
        });
    }

    /** Pays the prize to the winner from cash or a bank account. */
    public static function pay(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $auction = Auction::find($id);
        if ($auction['payoutStatus'] === 'paid') {
            throw HttpException::unprocessable('This prize has already been paid');
        }

        $in = $req->input();
        $mode = $in->enum('payoutMode', ['cash', 'bank_transfer', 'cheque']);
        $accountId = $in->id('bankAccountId', $mode !== null && $mode !== 'cash');
        $reference = $in->reference('payoutReference', $mode !== null && $mode !== 'cash');
        $date = $in->date('paidDate', false, date('Y-m-d'));
        if ($mode === 'cash' && Ledger::cashBalance() < $auction['prizeAmount']) {
            $in->error('payoutMode', 'Cash in hand (' . Audit::money(Ledger::cashBalance()) . ') is less than the prize. Pay by bank or cheque.');
        } elseif ($accountId !== null) {
            $balance = BankAccount::activeBalance($accountId);
            if ($balance === null) {
                $in->error('bankAccountId', 'Choose an active bank account');
            } elseif ($balance < $auction['prizeAmount']) {
                $in->error('bankAccountId', 'This account\'s balance (' . Audit::money($balance) . ') is less than the prize');
            }
        }
        $in->validate();
        Ledger::assertDayOpen($date);

        DB::transaction(function () use ($auction, $id, $mode, $accountId, $reference, $date) {
            $description = "Prize payout {$auction['auctionCode']} - {$auction['customerName']}";
            if ($mode === 'cash') {
                Ledger::cash($date, $auction['auctionCode'], $description, $auction['prizeAmount'], 0, 'payment');
            } else {
                Ledger::bank($accountId, $date, $description, 0, $auction['prizeAmount'], 'withdrawal');
            }
            Auction::update($id, [
                'payout_status' => 'paid',
                'payout_mode' => $mode,
                'bank_account_id' => $mode === 'cash' ? null : $accountId,
                'payout_reference' => $reference,
                'paid_date' => $date,
            ]);
            Audit::log('Prize Paid', 'Auctions', $auction['auctionCode'], 'pending', Audit::money($auction['prizeAmount']) . " ($mode)");
        });
        return Auction::find($id);
    }
}
