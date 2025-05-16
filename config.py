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