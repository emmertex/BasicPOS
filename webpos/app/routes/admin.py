from flask import Blueprint, render_template

bp = Blueprint('admin', __name__)

@bp.route('/admin')
def admin_page():
    return render_template('admin.html') 