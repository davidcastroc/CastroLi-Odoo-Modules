# -*- coding: utf-8 -*-
from odoo import models

class PosSession(models.Model):
    _inherit = 'pos.session'

    def _loader_params_res_currency(self):
        result = super()._loader_params_res_currency()
        result['params'] = {
            'search_params': {
                'domain': [],
                'fields': [],
            },
        }
        return result

    def _get_pos_ui_res_currency(self, params):
        result = super()._get_pos_ui_res_currency(params)
        currencies = self.config_id.currency_ids
        currency_params = self.env['res.currency'].search_read([('id', 'in', currencies.ids)])
        result['currency_params'] = currency_params
        return result