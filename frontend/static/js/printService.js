import { apiCall } from './apiService.js'; // Might be needed if fetching print templates/settings
import { showToast } from './toastService.js';
import { state } from './uiState.js';

// DOM Elements (cached in initPrintService)
let printOptionsModal;
let closePrintOptionsModalButton;
let printOptionsModalTitle;
let printOptionsSaleIdInput;
let printInvoiceA4Btn;
let printInvoiceReceiptBtn;
let printQuoteA4Btn;
let printQuoteReceiptBtn;

export function initPrintService() {
    printOptionsModal = document.getElementById('print-options-modal');
    closePrintOptionsModalButton = document.getElementById('close-print-options-modal');
    printOptionsModalTitle = document.getElementById('print-options-modal-title');
    printOptionsSaleIdInput = document.getElementById('print-options-sale-id'); // Hidden input to store sale ID
    printInvoiceA4Btn = document.getElementById('print-invoice-a4-btn');
    printInvoiceReceiptBtn = document.getElementById('print-invoice-receipt-btn');
    printQuoteA4Btn = document.getElementById('print-quote-a4-btn');
    printQuoteReceiptBtn = document.getElementById('print-quote-receipt-btn');

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
    
    // Optional: Close modal on window click outside
    // window.addEventListener('click', (event) => {
    //     if (printOptionsModal && event.target == printOptionsModal) {
    //         closePrintOptionsModal();
    //     }
    // });
}

export function openPrintOptionsModal(saleId, saleStatus = 'Invoice') {
    if (!printOptionsModal || !printOptionsModalTitle || !printOptionsSaleIdInput || !printInvoiceA4Btn || !printInvoiceReceiptBtn || !printQuoteA4Btn || !printQuoteReceiptBtn) {
        console.error("Print options modal elements not found or not initialized.");
        showToast("Cannot open print options.", "error");
        return;
    }

    printOptionsSaleIdInput.value = saleId;
    printOptionsModalTitle.textContent = `Print Options for Sale ID: ${saleId}`;

    // Show/hide buttons based on sale status (e.g., Paid sale usually means Invoice)
    // Quotes would show quote buttons.
    if (saleStatus.toLowerCase() === 'quote') {
        printInvoiceA4Btn.style.display = 'none';
        printInvoiceReceiptBtn.style.display = 'none';
        printQuoteA4Btn.style.display = 'inline-block';
        printQuoteReceiptBtn.style.display = 'inline-block';
    } else { // For Open, Paid, Invoice, etc.
        printInvoiceA4Btn.style.display = 'inline-block';
        printInvoiceReceiptBtn.style.display = 'inline-block';
        printQuoteA4Btn.style.display = 'none';
        printQuoteReceiptBtn.style.display = 'none';
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
    const url = `/print/${docType}/${format}/${saleId}`;
    
    showToast(`Opening ${docType} (${format}) for Sale ID ${saleId}...`, "info");
    window.open(url, '_blank');
    // Do not close the print options modal here, user might want to print another format.
    // closePrintOptionsModal(); 
} 