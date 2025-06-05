import { apiCall } from './apiService.js'; // Might be needed if fetching print templates/settings
import { showToast } from './toastService.js';
import { state } from './uiState.js';

// DOM Elements (cached in initPrintService)
let printOptionsModal;
let closePrintOptionsModalButton;
let printOptionsModalTitle;
let printOptionsSaleIdInput;
let printOptionsCustomerEmailInput; // New: For customer email
let printInvoiceA4Btn;
let printInvoiceReceiptBtn;
let printQuoteA4Btn;
let printQuoteReceiptBtn;
let emailInvoiceA4Btn; // New: Email Invoice A4 button
let emailQuoteA4Btn;   // New: Email Quote A4 button

export function initPrintService() {
    printOptionsModal = document.getElementById('print-options-modal');
    closePrintOptionsModalButton = document.getElementById('close-print-options-modal');
    printOptionsModalTitle = document.getElementById('print-options-modal-title');
    printOptionsSaleIdInput = document.getElementById('print-options-sale-id'); // Hidden input to store sale ID
    printOptionsCustomerEmailInput = document.getElementById('print-options-customer-email'); // New

    printInvoiceA4Btn = document.getElementById('print-invoice-a4-btn');
    printInvoiceReceiptBtn = document.getElementById('print-invoice-receipt-btn');
    printQuoteA4Btn = document.getElementById('print-quote-a4-btn');
    printQuoteReceiptBtn = document.getElementById('print-quote-receipt-btn');
    emailInvoiceA4Btn = document.getElementById('email-invoice-a4-btn'); // New
    emailQuoteA4Btn = document.getElementById('email-quote-a4-btn');     // New

    if (closePrintOptionsModalButton) {
        closePrintOptionsModalButton.addEventListener('click', closePrintOptionsModal);
    }
    if (printInvoiceA4Btn) {
        printInvoiceA4Btn.addEventListener('click', () => handlePrintAction('invoice', 'a4'));
    }
    if (printInvoiceReceiptBtn) {
        printInvoiceReceiptBtn.addEventListener('click', () => handlePrintAction('invoice', 'receipt'));
    }
    if (printQuoteA4Btn) {
        printQuoteA4Btn.addEventListener('click', () => handlePrintAction('quote', 'a4'));
    }
    if (printQuoteReceiptBtn) {
        printQuoteReceiptBtn.addEventListener('click', () => handlePrintAction('quote', 'receipt'));
    }
    if (emailInvoiceA4Btn) { // New
        emailInvoiceA4Btn.addEventListener('click', () => handleEmailAction('invoice'));
    }
    if (emailQuoteA4Btn) {   // New
        emailQuoteA4Btn.addEventListener('click', () => handleEmailAction('quote'));
    }
    
    // Optional: Close modal on window click outside
    // window.addEventListener('click', (event) => {
    //     if (printOptionsModal && event.target == printOptionsModal) {
    //         closePrintOptionsModal();
    //     }
    // });
}

export function openPrintOptionsModal(saleId, saleStatus = 'Invoice', customerEmail = null) {
    if (!printOptionsModal || !printOptionsModalTitle || !printOptionsSaleIdInput || 
        !printOptionsCustomerEmailInput || !printInvoiceA4Btn || !printInvoiceReceiptBtn || 
        !printQuoteA4Btn || !printQuoteReceiptBtn || !emailInvoiceA4Btn || !emailQuoteA4Btn) {
        console.error("Print options modal elements not found or not initialized properly.");
        showToast("Cannot open print options. Key elements missing.", "error");
        return;
    }

    printOptionsSaleIdInput.value = saleId;
    printOptionsCustomerEmailInput.value = customerEmail || ''; // Store customer email or empty string
    printOptionsModalTitle.textContent = `Options for Sale ID: ${saleId}`;

    // Default all buttons to hidden, then show based on logic
    printInvoiceA4Btn.style.display = 'none';
    printInvoiceReceiptBtn.style.display = 'none';
    printQuoteA4Btn.style.display = 'none';
    printQuoteReceiptBtn.style.display = 'none';
    emailInvoiceA4Btn.style.display = 'none';
    emailQuoteA4Btn.style.display = 'none';

    const hasEmail = customerEmail && customerEmail.trim() !== '';

    if (saleStatus.toLowerCase() === 'quote') {
        printQuoteA4Btn.style.display = 'inline-block';
        printQuoteReceiptBtn.style.display = 'inline-block';
        if (hasEmail) {
            emailQuoteA4Btn.style.display = 'inline-block';
        }
    } else { // For Open, Paid, Invoice, etc.
        printInvoiceA4Btn.style.display = 'inline-block';
        printInvoiceReceiptBtn.style.display = 'inline-block';
        if (hasEmail) {
            emailInvoiceA4Btn.style.display = 'inline-block';
        }
    }

    printOptionsModal.style.display = 'block';
}

export function closePrintOptionsModal() {
    if (printOptionsModal) {
        printOptionsModal.style.display = 'none';
    }
}

// docType: 'invoice' or 'quote'
// format: 'a4' or 'receipt'
function handlePrintAction(docType, format) {
    if (!printOptionsSaleIdInput || !printOptionsSaleIdInput.value) {
        showToast("Sale ID not found for printing.", "error");
        return;
    }
    const saleId = printOptionsSaleIdInput.value;
    // Corrected URL construction
    const url = `/print/sale/${saleId}?doc_type=${docType}&format=${format}`;
    
    showToast(`Opening ${docType} (${format}) for Sale ID ${saleId}...`, "info");
    window.open(url, '_blank');
}

// New function to handle emailing A4 document
async function handleEmailAction(docType) {
    if (!printOptionsSaleIdInput || !printOptionsSaleIdInput.value) {
        showToast("Sale ID not found for emailing.", "error");
        return;
    }
    if (!printOptionsCustomerEmailInput || !printOptionsCustomerEmailInput.value) {
        showToast("Customer email not found for emailing.", "error");
        // This should ideally be prevented by not showing the button if email is absent,
        // but double-check here.
        return;
    }

    const saleId = printOptionsSaleIdInput.value;
    const customerEmail = printOptionsCustomerEmailInput.value;

    const actionText = docType === 'invoice' ? 'Invoice' : 'Quote';
    showToast(`Emailing ${actionText} (A4) for Sale ID ${saleId} to ${customerEmail}...`, "info");

    try {
        const response = await apiCall(`/print/email_document/${saleId}?doc_type=${docType}`, 'POST', null, null, false);
        
        // Add a check for null or undefined response
        if (!response) {
            showToast(`Error emailing: No response from server (Not Found or other network issue).`, "error");
            console.error(`Error emailing ${docType} for sale ${saleId}: No response object from apiCall.`);
            return;
        }

        if (response.message) {
            showToast(response.message, "success");
            closePrintOptionsModal(); // Close modal on success
        } else if (response.error) {
            showToast(`Error emailing: ${response.error}`, "error");
        } else {
            // If response is an empty object or doesn't match expected structure
            showToast("Email action completed, but an unexpected response was received.", "warning");
            console.warn("Unexpected response structure from email endpoint:", response);
        }
    } catch (error) {
        console.error(`Error emailing ${docType} for sale ${saleId}:`, error);
        showToast(`Failed to email ${actionText}. Error: ${error.message || 'Unknown error'}`, "error");
    }
} 