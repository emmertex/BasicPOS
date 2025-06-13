import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state, setState } from './uiState.js'; // Assuming setState might be needed for currentSale
import { loadSaleIntoCart, updateCartDisplay, isEftposFeeEnabled } from './cart.js'; // For updating cart after payment
import { openPrintOptionsModal } from './printService.js';
import { loadParkedSales } from './salesService.js'; // Import loadParkedSales

// DOM Elements (cached in initPaymentService)
let paymentModal;
let paymentModalSaleIdInput;
let paymentModalTotalAmountSpan; // To display total amount of the sale
let paymentAmountInput;        // Amount being paid now
let paymentTypeSelect;         // If you add a payment type dropdown
let invoiceRemainingButton;
let payCashButton;
let payChequeButton;
let payEftposButton;
let closePaymentModalButton;   // Assuming a dedicated close button

export function initPaymentService() {
    paymentModal = document.getElementById('paymentModal');
    paymentModalSaleIdInput = document.getElementById('paymentModalSaleId');
    paymentModalTotalAmountSpan = document.getElementById('payment-modal-total-amount'); // Example ID
    paymentAmountInput = document.getElementById('paymentAmount');
    // paymentTypeSelect = document.getElementById('paymentTypeSelect'); // If you have this
    invoiceRemainingButton = document.getElementById('invoiceRemainingButton');
    payCashButton = document.getElementById('payCashButton');
    payChequeButton = document.getElementById('payChequeButton');
    payEftposButton = document.getElementById('payEftposButton');
    closePaymentModalButton = document.getElementById('close-payment-modal-button'); // Example ID for a close button

    if (payCashButton) payCashButton.addEventListener('click', () => handleSubmitPayment('Cash'));
    if (payChequeButton) payChequeButton.addEventListener('click', () => handleSubmitPayment('Cheque'));
    if (payEftposButton) payEftposButton.addEventListener('click', () => handleSubmitPayment('EFTPOS'));
    if (invoiceRemainingButton) invoiceRemainingButton.addEventListener('click', handleInvoiceAndKeepOpen);
    if (closePaymentModalButton) closePaymentModalButton.addEventListener('click', closePaymentModal);
    
    // Window click to close modal (if desired, can be kept in app.js or moved here)
    // window.addEventListener('click', (event) => {
    //     if (paymentModal && event.target == paymentModal) {
    //         closePaymentModal();
    //     }
    // });
}

export function openPaymentModal(saleToProcess) {
    if (!paymentModal || !paymentModalSaleIdInput || !paymentAmountInput || !invoiceRemainingButton || !paymentModalTotalAmountSpan) {
        console.error("Payment modal elements not found or not initialized.");
        showToast("Cannot open payment modal.", "error");
        return;
    }

    if (!saleToProcess || !saleToProcess.id || saleToProcess.amount_due === undefined) {
        showToast("Invalid sale data for payment modal.", "error");
        console.error("openPaymentModal: Invalid saleToProcess data", saleToProcess);
        return;
    }

    paymentModalSaleIdInput.value = saleToProcess.id;
    if(paymentModalTotalAmountSpan) paymentModalTotalAmountSpan.textContent = saleToProcess.final_grand_total !== undefined ? saleToProcess.final_grand_total.toFixed(2) : '0.00';
    paymentAmountInput.value = saleToProcess.amount_due.toFixed(2);
    paymentModal.style.display = 'block';

    // Show/hide payment buttons based on EFTPOS fee toggle
    const canInvoice = saleToProcess.status === 'Open' || saleToProcess.status === 'Quote';

    if (isEftposFeeEnabled()) {
        if (payEftposButton) payEftposButton.style.display = 'inline-block';
        if (payCashButton) payCashButton.style.display = 'none';
        if (payChequeButton) payChequeButton.style.display = 'none';
        if (invoiceRemainingButton) invoiceRemainingButton.style.display = 'none';
    } else {
        if (payEftposButton) payEftposButton.style.display = 'none';
        if (payCashButton) payCashButton.style.display = 'inline-block';
        if (payChequeButton) payChequeButton.style.display = 'inline-block';
        if (invoiceRemainingButton) {
             invoiceRemainingButton.style.display = canInvoice ? 'inline-block' : 'none';
        }
    }
}

export function closePaymentModal() {
    if (paymentModal) {
        paymentModal.style.display = 'none';
    }
}

async function handleSubmitPayment(paymentType) {
    if (!paymentModalSaleIdInput || !paymentAmountInput) {
        showToast("Payment form elements not available.", "error");
        return;
    }
    const saleId = paymentModalSaleIdInput.value;
    const amount = parseFloat(paymentAmountInput.value);

    if (!saleId) {
        showToast("Sale ID is missing for payment.", "error");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showToast("Invalid payment amount.", "error");
        return;
    }

    const paymentData = {
        sale_id: saleId,
        amount: amount,
        payment_type: paymentType
    };

    try {
        const result = await apiCall('/payments/', 'POST', paymentData);
        if (result && result.success) {
            showToast("Payment processed successfully!", "success");
            closePaymentModal();
            let finalSaleStatus = 'Unknown'; // For deciding print options
            let customerEmailForPrint = null; // Variable to hold customer email

            if (state.currentSale && state.currentSale.id == saleId) {
                const updatedSale = await apiCall(`/sales/${saleId}`);
                if (updatedSale) {
                    state.currentSale = updatedSale; // Update current sale state
                    finalSaleStatus = updatedSale.status;
                    // Extract customer email
                    customerEmailForPrint = updatedSale.customer && updatedSale.customer.email ? updatedSale.customer.email : null;
                    updateCartDisplay(); 
                } else {
                    // If fetching updatedSale fails, we might not have email.
                    loadSaleIntoCart(saleId); 
                }
            } else {
                // If the processed sale wasn't the current one, fetch its details
                const saleData = await apiCall(`/sales/${saleId}`);
                if(saleData) {
                    finalSaleStatus = saleData.status;
                    // Extract customer email
                    customerEmailForPrint = saleData.customer && saleData.customer.email ? saleData.customer.email : null;
                    // If the sale just paid for was not the one in cart, and should now be, then load it.
                    // Example: if (state.currentSale?.id !== saleId) { loadSaleIntoCart(saleId, saleData); }
                }
            }
            
            loadParkedSales(); // Refresh parked sales list

            // Call openPrintOptionsModal with customerEmailForPrint
            openPrintOptionsModal(saleId, finalSaleStatus, customerEmailForPrint);

        } else {
            showToast(result.message || "Payment failed. Please try again.", "error");
        }
    } catch (error) {
        console.error("Error submitting payment:", error);
        showToast("Error submitting payment: " + error.message, "error");
    }
}

async function handleInvoiceAndKeepOpen() {
    if (!state.currentSale || !state.currentSale.id || (state.currentSale.status !== 'Open' && state.currentSale.status !== 'Quote')) {
        showToast("This action is only valid for 'Open' or 'Quote' sales.", 'warning');
        return;
    }
    const saleId = state.currentSale.id;
    showToast("Invoicing and keeping sale open...", "info");

    // This might just be a state change if "Invoiced" is a status, or no backend change if it just means print.
    // For now, assume it might change status to 'Invoiced' or similar if such a status exists.
    // Or it simply closes the payment modal and does nothing to the sale status itself other than refresh.
    
    // Example: If you have an 'Invoiced' status that behaves like 'Open' but signifies it was printed/sent.
    // const result = await apiCall(`/sales/${saleId}`, 'PUT', { status: 'Invoiced' }); 
    // if (result && result.id) {
    //     state.currentSale = result;
    //     updateCartDisplay();
    //     showToast('Sale marked as Invoiced and remains open.', 'success');
    // } else {
    //     showToast('Could not update sale status to Invoiced.', 'error');
    // }

    closePaymentModal();
    // Usually, one would then trigger a print action here, e.g.:
    // window.open(`/print/invoice/a4/${saleId}`, '_blank');
    showToast("Payment modal closed. Sale remains open.", "info"); 
    // No actual status change here, assuming it's just for early exit from payment to print.
} 