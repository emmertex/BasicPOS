from flask import Blueprint, render_template, request, jsonify, current_app
from app.services.sale_service import SaleService
from app.services.item_service import ItemService
from datetime import datetime, timedelta
from decimal import Decimal
from markupsafe import escape # For nl2br filter

print_bp = Blueprint('print', __name__, url_prefix='/print')

# Helper to format date for display in templates
@print_bp.app_template_filter('format_date')
def format_date_filter(date_str):
    if not date_str: return 'N/A'
    try:
        # Assuming date_str is ISO format from backend (e.g., payment.payment_date.isoformat())
        dt_obj = datetime.fromisoformat(date_str)
        return dt_obj.strftime('%d/%m/%Y')
    except (ValueError, TypeError):
        return date_str # Return original if parsing fails

# nl2br filter: new line to <br>
@print_bp.app_template_filter('nl2br')
def nl2br_filter(s):
    if not isinstance(s, str):
        return s # Return as is if not a string
    # Escape HTML, then replace newlines. Using markupsafe.escape for safety.
    s_escaped = str(escape(s)) 
    return s_escaped.replace('\n', '<br>\n')

@print_bp.route('/sale/<int:sale_id>', methods=['GET'])
def print_sale_document(sale_id):
    doc_type = request.args.get('doc_type', 'invoice').lower() # invoice or quote
    doc_format = request.args.get('format', 'a4').lower()     # a4 or receipt

    sale = SaleService.get_sale_by_id(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404

    # Ensure sale details are fully loaded (customer, items, payments)
    # The SaleService.get_sale_by_id should ideally handle eager loading or ensure all data is available.
    # If not, we might need to explicitly load sale.customer, sale.sale_items, sale.payments here.
    # For now, assuming sale object from service is complete enough for sale_to_dict and template access.

    # Prepare company details (these should ideally come from app config or a settings model)
    company_details = {
        "company_name": current_app.config.get('COMPANY_NAME', 'Your Company Name'),
        "company_logo_url": current_app.config.get('COMPANY_LOGO_URL_A4', '/static/images/logo_a4.png'), # Placeholder
        "company_logo_url_small": current_app.config.get('COMPANY_LOGO_URL_RECEIPT', '/static/images/logo_receipt.png'), # Placeholder
        "company_abn": current_app.config.get('COMPANY_ABN', 'ABN: XX XXX XXX XXX'),
        "company_address_line1": current_app.config.get('COMPANY_ADDRESS_LINE1', '123 Business St'),
        "company_address_line2": current_app.config.get('COMPANY_ADDRESS_LINE2', ''),
        "company_city_state_postcode": current_app.config.get('COMPANY_CITY_STATE_POSTCODE', 'Businesstown, ST 12345'),
        "company_phone": current_app.config.get('COMPANY_PHONE', ' (00) 1234 5678'),
        "company_email": current_app.config.get('COMPANY_EMAIL', 'contact@example.com'),
        "company_website": current_app.config.get('COMPANY_WEBSITE', 'www.example.com'),
        "company_footer_message": current_app.config.get('COMPANY_FOOTER_A4', 'Thank you for your business!'),
        "company_footer_message_receipt": current_app.config.get('COMPANY_FOOTER_RECEIPT', 'Thanks!'),
        "invoice_payment_instructions": current_app.config.get('INVOICE_PAYMENT_INSTRUCTIONS', 'Please pay within 14 days. BSB: XXX-XXX Acc: XXXXXXXX Ref: Invoice #'),
        "quotation_terms": current_app.config.get('QUOTATION_TERMS_A4', 'This quotation is valid for 14 days. Prices are subject to change thereafter. All items subject to availability.'),
        "quotation_terms_short": current_app.config.get('QUOTATION_TERMS_RECEIPT', 'Quote valid 14 days.'),
        "gst_rate_percentage": current_app.config.get('GST_RATE_PERCENTAGE', 10)
    }

    document_title = "Invoice" if doc_type == 'invoice' else "Quotation"
    generation_date = datetime.now().strftime('%d %B %Y')
    generation_date_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    quotation_valid_until_date = (datetime.now() + timedelta(days=14)).strftime('%d %B %Y')

    # Calculate new detailed breakdown of totals for printing
    subtotal_gross_original_calc = sum(
        (si.price_at_sale * si.quantity) for si in sale.sale_items if si.price_at_sale is not None and si.quantity is not None
    )
    subtotal_gross_original_calc = Decimal(subtotal_gross_original_calc).quantize(Decimal('0.01'))

    total_line_item_discounts_calc = sum(
        ((si.price_at_sale - si.sale_price) * si.quantity) 
        for si in sale.sale_items 
        if si.price_at_sale is not None and si.sale_price is not None and si.quantity is not None
    )
    total_line_item_discounts_calc = Decimal(total_line_item_discounts_calc).quantize(Decimal('0.01'))

    overall_discount_amount_applied_calc = Decimal(sale.overall_discount_amount_applied or '0.00').quantize(Decimal('0.01'))

    net_subtotal_before_tax_calc = subtotal_gross_original_calc - total_line_item_discounts_calc - overall_discount_amount_applied_calc
    net_subtotal_before_tax_calc = net_subtotal_before_tax_calc.quantize(Decimal('0.01'))

    gst_rate_percentage_config = Decimal(company_details.get('gst_rate_percentage', '10'))
    gst_amount_calc = Decimal('0.00')
    if net_subtotal_before_tax_calc > 0 and gst_rate_percentage_config > 0:
        gst_amount_calc = (net_subtotal_before_tax_calc * (gst_rate_percentage_config / Decimal('100'))).quantize(Decimal('0.01'))

    final_grand_total_calc = net_subtotal_before_tax_calc + gst_amount_calc
    
    amount_paid_calc = sum(p.amount for p in sale.payments if p.amount is not None)
    amount_paid_calc = Decimal(amount_paid_calc).quantize(Decimal('0.01'))
    amount_due_calc = final_grand_total_calc - amount_paid_calc

    render_context = {
        "sale": sale, 
        "document_title": document_title,
        "generation_date": generation_date,
        "generation_date_time": generation_date_time,
        "quotation_valid_until_date": quotation_valid_until_date,
        
        # New financial breakdown for templates
        "subtotal_gross_original": subtotal_gross_original_calc,
        "total_line_item_discounts": total_line_item_discounts_calc,
        "overall_discount_applied": overall_discount_amount_applied_calc, # sale.overall_discount_amount_applied is also available directly
        "net_subtotal_final": net_subtotal_before_tax_calc,
        "gst_total": gst_amount_calc,
        "grand_total_final": final_grand_total_calc,
        "total_paid": amount_paid_calc,
        "amount_due_final": amount_due_calc,

        **company_details
    }

    template_name = "print/a4_document.html" if doc_format == 'a4' else "print/receipt_document.html"
    
    return render_template(template_name, **render_context)

@print_bp.route('/label/<int:item_id>', methods=['GET'])
def print_item_label(item_id):
    item_model = ItemService.get_item_by_id(item_id) # Returns an Item model instance

    if not item_model:
        return jsonify({"error": "Item not found"}), 404

    primary_photo_url_for_label = None
    if item_model.photos:
        primary_photo_model = next((p for p in item_model.photos if p.is_primary), None)
        photo_to_use = primary_photo_model if primary_photo_model else item_model.photos[0]

        if photo_to_use and photo_to_use.image_url:
            base_image_url = photo_to_use.image_url # This is the base filename like 'image.jpg'
            # Construct the small URL, assuming UPLOAD_FOLDER is served at /uploads/
            # and small images are named like 'image_small.jpg'
            filename_parts = base_image_url.rsplit('.', 1)
            if len(filename_parts) == 2:
                small_filename = f"{filename_parts[0]}_small.{filename_parts[1]}"
            else: # Fallback if no extension, unlikely for image files
                small_filename = f"{base_image_url}_small"
            
            # Assuming static files are served from /uploads for item images
            # This should align with how ItemService.item_to_dict constructs URLs
            # or how your app serves these uploaded files.
            # A common pattern is request.host_url + url_for('static', filename=f'uploads/{small_filename}')
            # but for simplicity in template if paths are relative to domain root:
            uploads_path_segment = current_app.config.get('UPLOAD_FOLDER_URL_SEGMENT', 'uploads')
            primary_photo_url_for_label = f"/{uploads_path_segment}/{small_filename}"

    context = {
        "item": {
            "id": item_model.id,
            "title": item_model.title,
            "sku": item_model.sku,
            "price": item_model.price,
            "primary_photo_url": primary_photo_url_for_label
        }
    }
    return render_template("print/item_label.html", **context) 