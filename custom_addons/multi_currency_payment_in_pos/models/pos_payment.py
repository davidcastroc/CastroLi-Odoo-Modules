# -*- coding: utf-8 -*-
from odoo import fields, models

class PosPayment(models.Model):
    _inherit = 'pos.payment'

    payment_currency = fields.Char(
        string='Payment Currency',
        help='Currency chosen in POS.'
    )
    currency_amount = fields.Float(
        string='Currency Amount',
        help='Amount in the selected currency.'
    )