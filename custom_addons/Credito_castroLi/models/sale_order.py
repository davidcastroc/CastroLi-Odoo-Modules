from odoo import models, api, fields
from odoo.exceptions import ValidationError


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    cl_credit_limit = fields.Monetary(
        string="Límite de crédito",
        currency_field="currency_id",
        compute="_compute_credit_snapshot",
        readonly=True
    )
    cl_credit_used = fields.Monetary(
        string="Crédito usado",
        currency_field="currency_id",
        compute="_compute_credit_snapshot",
        readonly=True
    )
    cl_credit_available = fields.Monetary(
        string="Crédito disponible",
        currency_field="currency_id",
        compute="_compute_credit_snapshot",
        readonly=True
    )
    cl_credit_overlimit = fields.Boolean(
        string="Sobre el límite",
        compute="_compute_credit_snapshot",
        readonly=True
    )

    @api.depends('partner_id', 'amount_total', 'payment_term_id')
    def _compute_credit_snapshot(self):
        """Calcula el crédito actual, usado y disponible del cliente."""
        for order in self:
            partner = order.partner_id
            if not partner:
                order.cl_credit_limit = 0.0
                order.cl_credit_used = 0.0
                order.cl_credit_available = 0.0
                order.cl_credit_overlimit = False
                continue

            limite = partner.credit_limit or 0.0
            usado = partner.credit or 0.0
            disponible = max(limite - usado, 0.0)
            order.cl_credit_limit = limite
            order.cl_credit_used = usado
            order.cl_credit_available = disponible
            order.cl_credit_overlimit = (usado + order.amount_total) > limite

    @api.constrains('amount_total', 'payment_term_id')
    def _check_credit_limit(self):
        for order in self:
            partner = order.partner_id
            user = self.env.user

            # Detectar si el pedido es a crédito
            es_credito = False
            if order.payment_term_id:
                for line in order.payment_term_id.line_ids:
                    dias = 0
                    for campo in ['days_after_invoice_date', 'days', 'value_days', 'nb_days']:
                        if hasattr(line, campo):
                            dias = getattr(line, campo)
                            break
                    if dias > 0:
                        es_credito = True
                        break

            # Si no es crédito, no se valida
            if not es_credito:
                continue

            # ⚠️ Caso 1: cliente SIN condiciones de crédito
            if not partner.credit_limit or partner.credit_limit == 0:
                raise ValidationError(
                    f"⚠️ El cliente '{partner.name}' no tiene condiciones de crédito activas.\n\n"
                    f"Solo puede realizar compras con pago contado o inmediato."
                )

            # ⚠️ Caso 2: cliente CON límite de crédito asignado
            deuda_actual = partner.credit or 0.0
            total_proyectado = deuda_actual + order.amount_total

            # Si supera el límite...
            if total_proyectado > partner.credit_limit:
                # Solo los administradores pueden aprobar
                if not user.has_group('base.group_system'):
                    raise ValidationError(
                        f"⚠️ El cliente '{partner.name}' ha superado su límite de crédito de "
                        f"₡{partner.credit_limit:,.2f}.\n\n"
                        f"Deuda actual: ₡{deuda_actual:,.2f}\n"
                        f"Pedido actual: ₡{order.amount_total:,.2f}\n"
                        f"Total proyectado: ₡{total_proyectado:,.2f}\n\n"
                        f"Solo un administrador puede confirmar este pedido."
                    )

    def action_force_confirm_admin(self):
        """Permite a un admin confirmar el pedido aunque exceda el límite."""
        if not self.env.user.has_group('base.group_system'):
            raise ValidationError("Solo un administrador puede forzar esta aprobación.")
        self.message_post(body="⚠️ Pedido confirmado manualmente por administrador a pesar del límite de crédito.")
        return super(SaleOrder, self).action_confirm()