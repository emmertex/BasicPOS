const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        console.error('Toast container not found!');
        // Fallback to alert if toast system isn't available
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close-button';
    closeButton.innerHTML = '&times;'; // 'x' character
    closeButton.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500); // Match CSS transition time
    };
    toast.appendChild(closeButton);

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500); // Match CSS transition time
    }, duration);
} 