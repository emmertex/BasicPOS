import os

class ConfigWeb:
    SECRET_KEY = os.environ.get('WEB_SECRET_KEY') or 'a-super-secret-key-for-web'
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+pymysql://root:password@10.2.100.35/retail_pos_system'
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Path to the main application's upload folder
    # This assumes run_web.py is in web_frontend, and the main app is one level up.
    MAIN_APP_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    MAIN_APP_UPLOAD_FOLDER = os.path.join(MAIN_APP_PROJECT_ROOT,'app', 'static', 'uploads')

    COMPANY_NAME = "True Blue Dealers"
    COMPANY_LOGO_FILENAME = "images/TBLogo-Light.png"
    COMPANY_LOGO_FILENAME_DARK = "images/TBLogo-Dark.png"
    PLACEHOLDER_IMAGE_FILENAME = "images/TB-ImageUnavailable.png"

    COMPANY_ABN = "ABN: 26 616 970 403"
    COMPANY_ADDRESS_LINE1 = "125 Stawell Road"
    COMPANY_CITY_STATE_POSTCODE = "Horsham, VIC 3400"
    COMPANY_PHONE = "(03) 5382 2365"
    COMPANY_EMAIL = "sales@truebluedealers.com.au"
    COMPANY_WEBSITE = "truebluedealers.com.au"
    COMPANY_FOOTER_A4 = "THANK YOU FOR YOUR BUSINESS, FROM THE TRUE BLUE FAMILY!"

    APP_STATIC_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'static')
    IMAGES_FOLDER = os.path.join(APP_STATIC_FOLDER, 'images')
    UPLOADS_FOLDER_WEB = os.path.join(APP_STATIC_FOLDER, 'uploads')

    if not os.path.exists(IMAGES_FOLDER):
        os.makedirs(IMAGES_FOLDER)

    if not os.path.exists(UPLOADS_FOLDER_WEB):
        os.makedirs(UPLOADS_FOLDER_WEB)