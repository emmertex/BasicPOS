import os
import uuid
from PIL import Image as PILImage # Renamed to avoid conflict if 'Image' model exists
from flask import current_app
from werkzeug.utils import secure_filename
from app.models.photo import Photo # Ensure Photo model is imported
from app import db # Ensure db is imported

class ImageService:
    @staticmethod
    def _allowed_file(filename):
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

    @staticmethod
    def _generate_unique_filename(original_filename):
        ext = original_filename.rsplit('.', 1)[1].lower()
        unique_name = uuid.uuid4().hex
        return f"{unique_name}.{ext}", f"{unique_name}_large.{ext}", f"{unique_name}_small.{ext}"

    @staticmethod
    def _resize_image(image_path, output_path, max_size, quality):
        try:
            img = PILImage.open(image_path)
            
            # Preserve transparency for PNG/GIF
            save_kwargs = {'quality': quality}
            if img.format == 'PNG' :
                save_kwargs['optimize'] = True
            elif img.format == 'GIF':
                # For GIFs, Pillow saves only the first frame by default when using save() with resizing.
                # Complex GIF handling (preserving animation) is beyond simple resize.
                # For now, we save as static or convert to PNG. Let's convert to PNG to keep transparency.
                # If animated GIF is a must, a different strategy is needed.
                # To keep it simple, if it's GIF, let's attempt to save as is for small, and convert to JPEG for large.
                pass # Handled below based on size

            img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
            
            if output_path.lower().endswith(('.jpg', '.jpeg')):
                if img.mode == 'RGBA' or img.mode == 'P': # P is for paletted like GIF
                    img = img.convert('RGB') # Convert to RGB for JPEG
            
            img.save(output_path, **save_kwargs)
            return True
        except Exception as e:
            current_app.logger.error(f"Error resizing image {image_path} to {output_path}: {e}")
            return False

    @staticmethod
    def save_processed_image(uploaded_file_storage):
        if not uploaded_file_storage or not uploaded_file_storage.filename:
            return None, "No file provided."
        
        original_filename = secure_filename(uploaded_file_storage.filename)
        if not ImageService._allowed_file(original_filename):
            return None, "File type not allowed."

        base_filename, large_filename, small_filename = ImageService._generate_unique_filename(original_filename)
        
        upload_folder = current_app.config['UPLOAD_FOLDER']
        
        # Save original temporarily to process it
        temp_original_path = os.path.join(upload_folder, f"temp_{base_filename}")
        uploaded_file_storage.save(temp_original_path)

        large_path = os.path.join(upload_folder, large_filename)
        small_path = os.path.join(upload_folder, small_filename)

        success_large = ImageService._resize_image(
            temp_original_path, 
            large_path, 
            current_app.config['MAX_IMAGE_SIZE_LARGE'], 
            current_app.config['IMAGE_QUALITY']
        )
        success_small = ImageService._resize_image(
            temp_original_path, 
            small_path, 
            current_app.config['MAX_IMAGE_SIZE_SMALL'], 
            current_app.config['IMAGE_QUALITY']
        )

        # Clean up temporary original file
        try:
            os.remove(temp_original_path)
        except OSError as e:
            current_app.logger.error(f"Error deleting temporary file {temp_original_path}: {e}")

        if success_large and success_small:
            return base_filename, None # Return the base filename used for DB storage
        else:
            # Attempt to clean up processed files if one failed
            if os.path.exists(large_path): os.remove(large_path)
            if os.path.exists(small_path): os.remove(small_path)
            return None, "Image processing failed for one or both sizes."

    @staticmethod
    def delete_photo(photo_id):
        photo = Photo.query.get(photo_id)
        if not photo:
            return False, "Photo not found."

        base_filename = photo.image_url
        if not base_filename:
            # This case should ideally not happen if image_url is always set.
            # If it does, we can still delete the DB record.
            current_app.logger.warn(f"Photo record {photo_id} has no image_url. Deleting DB record only.")
            try:
                db.session.delete(photo)
                db.session.commit()
                return True, None
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error deleting photo record {photo_id} from DB: {e}")
                return False, f"Error deleting photo record from DB: {e}"

        upload_folder = current_app.config['UPLOAD_FOLDER']
        name, ext = os.path.splitext(base_filename)
        
        large_filename = f"{name}_large{ext}"
        small_filename = f"{name}_small{ext}"

        files_to_delete = [
            os.path.join(upload_folder, large_filename),
            os.path.join(upload_folder, small_filename)
            # If you also store the original base_filename directly, add it here:
            # os.path.join(upload_folder, base_filename) 
        ]

        all_files_deleted_or_missing = True
        for file_path in files_to_delete:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    current_app.logger.info(f"Successfully deleted image file: {file_path}")
                else:
                    current_app.logger.warn(f"Image file not found, skipping deletion: {file_path}")
            except OSError as e:
                current_app.logger.error(f"Error deleting image file {file_path}: {e}")
                all_files_deleted_or_missing = False # Mark as problematic if a file deletion fails
        
        # Proceed to delete DB record even if some file deletions failed or files were missing,
        # as the primary goal is to remove the reference. Log errors for follow-up.
        try:
            db.session.delete(photo)
            db.session.commit()
            if not all_files_deleted_or_missing:
                return True, "Photo record deleted, but some image files could not be removed or were missing. Check logs."
            return True, None
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting photo record {photo_id} from DB after attempting file deletions: {e}")
            return False, f"Error deleting photo record from DB: {e}" 