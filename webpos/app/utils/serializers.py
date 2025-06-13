from decimal import Decimal, ROUND_HALF_UP
from flask import current_app

def payment_to_dict(payment):
    if not payment:
        return None
    return {
        'id': payment.id,
        'sale_id': payment.sale_id,
        'payment_type': payment.payment_type,
        'amount': float(payment.amount) if payment.amount is not None else None,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
    }

def _simple_payment_to_dict_for_sale(payment):
    if not payment:
        return None
    return {
        'id': payment.id,
        'payment_type': payment.payment_type,
        'amount': float(payment.amount) if payment.amount is not None else 0.0,
        'payment_date': payment.payment_date.isoformat() if payment.payment_date else None
    }

def sale_item_to_dict(sale_item):
    from app.routes.items import item_to_dict
    
    if not sale_item:
        return None
    # Ensure sale_item.item is loaded, might need to adjust lazy loading or query options
    # For now, assuming it gets loaded by accessing it.

    # Safely get price_at_sale, defaulting to None if attribute is missing or value is None
    price_at_sale_value = getattr(sale_item, 'price_at_sale', None)
    discount_type_value = getattr(sale_item, 'discount_type', None)
    discount_value_value = getattr(sale_item, 'discount_value', None)

    return {
        'id': sale_item.id,
        'sale_id': sale_item.sale_id,
        'item_id': sale_item.item_id,
        'item': item_to_dict(sale_item.item) if sale_item.item else None, 
        'quantity': sale_item.quantity,
        'price_at_sale': float(price_at_sale_value) if price_at_sale_value is not None else None,
        'discount_type': discount_type_value,
        'discount_value': float(discount_value_value) if discount_value_value is not None else None,
        'sale_price': float(sale_item.sale_price) if sale_item.sale_price is not None else None,
        'notes': sale_item.notes,
        'line_total': float(sale_item.line_total) if hasattr(sale_item, 'line_total') and sale_item.line_total is not None else (sale_item.quantity * sale_item.sale_price)
    }

def sale_to_dict(sale):
    from app.models.customer import Customer
    from app.routes.customers import customer_to_dict
    
    if not sale:
        return None
    
    customer_details = None
    if sale.customer_id:
        customer = Customer.query.get(sale.customer_id) # Fetch the customer object
        customer_details = customer_to_dict(customer) # Serialize it

    # Calculate new detailed breakdown of totals
    subtotal_gross_original_calc = sum(
        (si.price_at_sale * si.quantity) for si in sale.sale_items if si.price_at_sale is not None and si.quantity is not None
    )
    subtotal_gross_original_calc = Decimal(subtotal_gross_original_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    total_line_item_discounts_calc = sum(
        ((si.price_at_sale - si.sale_price) * si.quantity) 
        for si in sale.sale_items 
        if si.price_at_sale is not None and si.sale_price is not None and si.quantity is not None
    )
    total_line_item_discounts_calc = Decimal(total_line_item_discounts_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    overall_discount_amount_applied_calc = Decimal(sale.overall_discount_amount_applied or '0.00').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    transaction_fee_calc = Decimal(sale.transaction_fee or '0.00').quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    net_subtotal_inc_tax_calc = subtotal_gross_original_calc - total_line_item_discounts_calc - overall_discount_amount_applied_calc
    net_subtotal_inc_tax_calc = net_subtotal_inc_tax_calc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    gst_rate_percentage = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', '10'))
    gst_divisor = Decimal('1') + (gst_rate_percentage / Decimal('100'))

    # Calculate GST from the subtotal (which is inc-GST)
    gst_from_subtotal = (net_subtotal_inc_tax_calc - (net_subtotal_inc_tax_calc / gst_divisor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Calculate GST from the fee (which is also inc-GST)
    gst_from_fee = (transaction_fee_calc - (transaction_fee_calc / gst_divisor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Total GST is the sum of the two
    gst_amount_calc = gst_from_subtotal + gst_from_fee
    
    # Grand total is simply the inc-GST subtotal plus the inc-GST fee
    final_grand_total_calc = net_subtotal_inc_tax_calc + transaction_fee_calc
    
    amount_paid_calc = sum(p.amount for p in sale.payments if p.amount is not None)
    amount_paid_calc = Decimal(amount_paid_calc).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    amount_due_calc = final_grand_total_calc - amount_paid_calc

    return {
        'id': sale.id,
        'customer_id': sale.customer_id,
        'customer': customer_details,
        'status': sale.status,
        'created_at': sale.created_at.isoformat() if sale.created_at else None,
        'updated_at': sale.updated_at.isoformat() if sale.updated_at else None,
        'customer_notes': sale.customer_notes,
        'internal_notes': sale.internal_notes,
        'purchase_order_number': sale.purchase_order_number,
        
        'overall_discount_type': sale.overall_discount_type,
        'overall_discount_value': float(sale.overall_discount_value) if sale.overall_discount_value is not None else 0.0,
        # 'overall_discount_amount_applied' is one of the main fields below

        'sale_items': [sale_item_to_dict(si) for si in sale.sale_items],
        'payments': [_simple_payment_to_dict_for_sale(p) for p in sale.payments], 
        
        # New detailed financial breakdown
        'subtotal_gross_original': float(subtotal_gross_original_calc),
        'total_line_item_discounts': float(total_line_item_discounts_calc),
        'overall_discount_amount_applied': float(overall_discount_amount_applied_calc),
        'net_subtotal_inc_tax': float(net_subtotal_inc_tax_calc),
        'gst_amount': float(gst_amount_calc),
        'transaction_fee': float(transaction_fee_calc),
        'final_grand_total': float(final_grand_total_calc),
        
        'amount_paid': float(amount_paid_calc),
        'amount_due': float(amount_due_calc),
        'gst_rate_percentage': float(gst_rate_percentage)
    }