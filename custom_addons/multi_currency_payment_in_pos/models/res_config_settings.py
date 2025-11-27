# -*- coding: utf-8 -*-
from odoo import models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'
    # Sin campos/vistas aquí en v18 (usamos una vista propia de pos.config).