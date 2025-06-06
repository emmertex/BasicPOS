from flask import Blueprint, render_template, request, jsonify, current_app
from app.services.sale_service import SaleService
from app.services.item_service import ItemService
from app.services.customer_service import CustomerService
from datetime import datetime, timedelta
from decimal import Decimal
from markupsafe import escape # For nl2br filter
from flask_mail import Message # For sending email
from app import mail # Import the mail instance from app context
from weasyprint import HTML as WeasyHTML # For PDF generation
import os # For file operations (saving and deleting PDF)
import uuid # For unique PDF filenames
from decimal import Decimal, ROUND_HALF_UP

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
    # Calculate net amount (ex GST) from gross amount (inc GST)
    net_subtotal_before_tax_calc = subtotal_gross_original_calc - total_line_item_discounts_calc - overall_discount_amount_applied_calc
    gst_rate_percentage = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', '10'))
    gst_amount_calc = Decimal('0.00')
    if net_subtotal_before_tax_calc > 0 and gst_rate_percentage > 0:
        # Since prices are GST inclusive, we need to calculate GST portion by dividing by (1 + GST rate)
        gst_divisor = Decimal('1') + (gst_rate_percentage / Decimal('100'))
        gst_amount_calc = (net_subtotal_before_tax_calc - (net_subtotal_before_tax_calc / gst_divisor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    final_grand_total_calc = net_subtotal_before_tax_calc

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

@print_bp.route('/email_document/<int:sale_id>', methods=['POST']) # POST is safer for actions
def email_sale_document(sale_id):
    doc_type = request.args.get('doc_type', 'invoice').lower() # invoice or quote

    sale = SaleService.get_sale_by_id(sale_id)
    if not sale:
        return jsonify({"error": "Sale not found"}), 404

    if not sale.customer or not sale.customer.email:
        return jsonify({"error": "Customer email not found for this sale."}), 400

    customer_email = sale.customer.email
    customer_name = sale.customer.name if sale.customer.name else "Valued Customer"
    
    document_title_for_email = "Invoice" if doc_type == 'invoice' else "Quotation"
    pdf_filename = f"{doc_type}_{sale_id}_{uuid.uuid4().hex[:8]}.pdf"
    
    # UPLOAD_FOLDER is defined in Config and accessible via current_app.config
    # Ensure this folder is writable by the application
    # For security and organization, consider a dedicated temp folder for generated PDFs
    upload_folder = current_app.config.get('UPLOAD_FOLDER')
    if not upload_folder:
        current_app.logger.error("UPLOAD_FOLDER not configured.")
        return jsonify({"error": "Server configuration error (upload folder missing)."}), 500
    
    pdf_path = os.path.join(upload_folder, pdf_filename)

    try:
        # --- Re-use or adapt context from print_sale_document ---
        company_details = {
            "company_name": current_app.config.get('COMPANY_NAME', 'Your Company Name'),
            "company_logo_url": current_app.config.get('COMPANY_LOGO_URL_A4', '/static/images/logo_a4.png'),
            "company_abn": current_app.config.get('COMPANY_ABN', 'ABN: XX XXX XXX XXX'),
            "company_address_line1": current_app.config.get('COMPANY_ADDRESS_LINE1', '123 Business St'),
            "company_address_line2": current_app.config.get('COMPANY_ADDRESS_LINE2', ''),
            "company_city_state_postcode": current_app.config.get('COMPANY_CITY_STATE_POSTCODE', 'Businesstown, ST 12345'),
            "company_phone": current_app.config.get('COMPANY_PHONE', ' (00) 1234 5678'),
            "company_email": current_app.config.get('COMPANY_EMAIL', 'contact@example.com'),
            "company_website": current_app.config.get('COMPANY_WEBSITE', 'www.example.com'),
            "company_footer_message": current_app.config.get('COMPANY_FOOTER_A4', 'Thank you for your business!'),
            "invoice_payment_instructions": current_app.config.get('INVOICE_PAYMENT_INSTRUCTIONS', 'Please pay within 14 days. BSB: XXX-XXX Acc: XXXXXXXX Ref: Invoice #'),
            "quotation_terms": current_app.config.get('QUOTATION_TERMS_A4', 'This quotation is valid for 14 days. Prices are subject to change thereafter. All items subject to availability.'),
            "gst_rate_percentage": current_app.config.get('GST_RATE_PERCENTAGE', 10)
        }
        document_title = "Invoice" if doc_type == 'invoice' else "Quotation"
        generation_date = datetime.now().strftime('%d %B %Y')
        generation_date_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S') # Not typically in A4, but here if needed
        quotation_valid_until_date = (datetime.now() + timedelta(days=14)).strftime('%d %B %Y')

        subtotal_gross_original_calc = sum((si.price_at_sale * si.quantity) for si in sale.sale_items if si.price_at_sale is not None and si.quantity is not None)
        subtotal_gross_original_calc = Decimal(subtotal_gross_original_calc).quantize(Decimal('0.01'))
        total_line_item_discounts_calc = sum(((si.price_at_sale - si.sale_price) * si.quantity) for si in sale.sale_items if si.price_at_sale is not None and si.sale_price is not None and si.quantity is not None)
        total_line_item_discounts_calc = Decimal(total_line_item_discounts_calc).quantize(Decimal('0.01'))
        overall_discount_amount_applied_calc = Decimal(sale.overall_discount_amount_applied or '0.00').quantize(Decimal('0.01'))
        # Calculate net amount (ex GST) from gross amount (inc GST)
        net_subtotal_before_tax_calc = subtotal_gross_original_calc - total_line_item_discounts_calc - overall_discount_amount_applied_calc
        gst_rate_percentage = Decimal(current_app.config.get('GST_RATE_PERCENTAGE', '10'))
        gst_amount_calc = Decimal('0.00')
        if net_subtotal_before_tax_calc > 0 and gst_rate_percentage > 0:
            # Since prices are GST inclusive, we need to calculate GST portion by dividing by (1 + GST rate)
            gst_divisor = Decimal('1') + (gst_rate_percentage / Decimal('100'))
            gst_amount_calc = (net_subtotal_before_tax_calc - (net_subtotal_before_tax_calc / gst_divisor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        final_grand_total_calc = net_subtotal_before_tax_calc

        amount_paid_calc = sum(p.amount for p in sale.payments if p.amount is not None)
        amount_paid_calc = Decimal(amount_paid_calc).quantize(Decimal('0.01'))
        amount_due_calc = final_grand_total_calc - amount_paid_calc

        render_context = {
            "sale": sale, 
            "document_title": document_title,
            "generation_date": generation_date,
            "generation_date_time": generation_date_time,
            "quotation_valid_until_date": quotation_valid_until_date,
            "subtotal_gross_original": subtotal_gross_original_calc,
            "total_line_item_discounts": total_line_item_discounts_calc,
            "overall_discount_applied": overall_discount_amount_applied_calc,
            "net_subtotal_final": net_subtotal_before_tax_calc,
            "gst_total": gst_amount_calc,
            "grand_total_final": final_grand_total_calc,
            "total_paid": amount_paid_calc,
            "amount_due_final": amount_due_calc,
            **company_details
        }
        # --- End of context preparation ---

        # Render HTML from template
        # Ensure your template path is correct, assuming 'print/a4_document.html'
        html_string = render_template("print/a4_document.html", **render_context)

        # Generate PDF
        # The base_url is important for WeasyPrint to find static assets (CSS, images)
        # referenced with relative paths in your template.
        # It should point to the root of your application where static files are served from.
        # Example: http://localhost:5000/
        # For local file paths to static assets, you might need more complex setup or absolute URLs in templates.
        # If your static files are correctly served by Flask, their URLs (e.g., /static/style.css)
        # should work if WeasyPrint resolves them against a proper base_url.
        # If logo URLs in config are absolute (e.g. http://.../logo.png), they should work.
        # If they are relative (e.g. /static/images/logo.png), base_url is critical.
        # For simplicity, assuming static assets are handled well or using absolute URLs for them in templates.
        # current_app.config['SERVER_NAME'] can be used if set, or construct it.
        # For now, we will rely on WeasyPrint's default behavior for relative paths which might require
        # running the app in a specific way or having CSS directly linked in HTML for it to find.
        # A safer approach is to provide an explicit `base_url`.
        
        # Construct base_url dynamically
        scheme = request.scheme
        host = request.host 
        base_url = f"{scheme}://{host}"

        pdf_file = WeasyHTML(string=html_string, base_url=base_url).write_pdf() # write_pdf() returns bytes

        # Save PDF temporarily to send as attachment
        with open(pdf_path, 'wb') as f:
            f.write(pdf_file)
        current_app.logger.info(f"PDF generated: {pdf_path}")

        # Create email message
        email_subject = f"{document_title_for_email} #{sale.id} from {company_details['company_name']}"
        email_body = f"""Hi {customer_name},

Please see attached {document_title_for_email.lower()}.

Any queries, feel free to contact us.

Thanks,
{current_app.config.get('MAIL_DEFAULT_SENDER_NAME', 'BasicPOS')}
"""
        # Ensure MAIL_DEFAULT_SENDER_EMAIL is correctly configured in config.py
        sender_email = current_app.config.get('MAIL_DEFAULT_SENDER_EMAIL')
        if not sender_email:
            current_app.logger.error("MAIL_DEFAULT_SENDER_EMAIL not configured.")
            # Clean up PDF before returning error
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            return jsonify({"error": "Server configuration error (sender email missing)."}), 500

        msg = Message(
            subject=email_subject,
            sender=(current_app.config.get('MAIL_DEFAULT_SENDER_NAME'), sender_email),
            recipients=[customer_email],
            body=email_body
        )
        
        with current_app.open_resource(pdf_path) as fp:
            msg.attach(
                filename=pdf_filename,
                content_type='application/pdf',
                data=fp.read()
            )
        
        mail.send(msg)
        current_app.logger.info(f"Email sent to {customer_email} with PDF {pdf_filename}")

        return jsonify({
            "message": f"{document_title_for_email} emailed successfully to {customer_email}.",
            "filename": pdf_filename
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error emailing document for sale {sale_id}: {e}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
    finally:
        # Clean up: delete the generated PDF file
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
                current_app.logger.info(f"PDF file {pdf_path} deleted successfully.")
            except Exception as e_remove:
                current_app.logger.error(f"Error deleting PDF file {pdf_path}: {e_remove}", exc_info=True)

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