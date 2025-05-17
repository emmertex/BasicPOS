import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-hard-to-guess-string'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+pymysql://retail_admin:localdev@localhost/retail_pos_system'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Image Upload Configuration
    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'app', 'static', 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    MAX_IMAGE_SIZE_LARGE = (3840, 3840)  # Max width, height for large images
    MAX_IMAGE_SIZE_SMALL = (480, 480)    # Max width, height for small images
    IMAGE_QUALITY = 85 # For JPEG

    # Ensure UPLOAD_FOLDER exists
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER) 

    # Receipt Related
    COMPANY_NAME = "True Blue Dealers"
    COMPANY_LOGO_URL_A4 = "/static/images/TrueBlueNew-1536x508.jpg" 
    COMPANY_LOGO_URL_RECEIPT = "/static/images/TrueBlueNew-1536x508.jpg" 
    COMPANY_ABN = "ABN: 26 616 970 403"
    COMPANY_ADDRESS_LINE1 = "125 Stawell Road"
    COMPANY_CITY_STATE_POSTCODE = "Horsham, VIC 3400"
    COMPANY_PHONE = "(03) 5382 2365"
    COMPANY_EMAIL = "sales@truebluedealers.com.au"
    COMPANY_WEBSITE = "truebluedealers.com.au"
    COMPANY_FOOTER_A4 = "THANK YOU FOR YOUR BUSINESS, FROM THE TRUE BLUE FAMILY!"
    COMPANY_FOOTER_RECEIPT = "THANK YOU FOR YOUR BUSINESS, FROM THE TRUE BLUE FAMILY!"
    INVOICE_PAYMENT_INSTRUCTIONS = "Please Make account payments to True Blue Team P/L BSB: 083-680 Acc: 90-074-9447 Ref: Invoice #97013"
    QUOTATION_TERMS_A4 = "This quotation is valid for 14 days from the date of issue. All prices are inclusive of GST unless otherwise stated. Errors and omissions excepted."
    QUOTATION_TERMS_RECEIPT = "Quote valid 14 days. E&OE."
    GST_RATE_PERCENTAGE = 10 