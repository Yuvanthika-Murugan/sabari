<?php

declare(strict_types=1);

namespace App\Models;

final class Voucher extends Model
{
    protected const TABLE = 'vouchers';
    protected const LABEL = 'Voucher';
    protected const SELECT = "SELECT CAST(v.id AS CHAR) AS id, v.voucher_number AS voucherNumber, DATE_FORMAT(v.voucher_date, '%Y-%m-%d') AS date,
        v.voucher_type AS voucherType, v.account, v.amount, v.payment_mode AS paymentMode, v.narration,
        COALESCE(u.name, '-') AS createdBy, v.approval_status AS approvalStatus
        FROM vouchers v LEFT JOIN users u ON u.id = v.created_by";
    protected const KEY = 'v.id';
    protected const ORDER = ' ORDER BY v.voucher_date DESC, v.id DESC';
    protected const FLOATS = ['amount'];
}
