import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state, setState } from './uiState.js'; // Assuming setState might be needed for currentSale
import { loadSaleIntoCart, updateCartDisplay } from './cart.js'; // For updating cart after payment
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
let payTyroButton;
let closePaymentModalButton;   // Assuming a dedicated close button

export function initPaymentService() {
    console.log("Initializing payment service...");
    
    // Get all required elements
    paymentModal = document.getElementById('paymentModal');
    paymentModalSaleIdInput = document.getElementById('paymentModalSaleId');
    paymentModalTotalAmountSpan = document.getElementById('payment-modal-total-amount');
    paymentAmountInput = document.getElementById('paymentAmount');
    invoiceRemainingButton = document.getElementById('invoiceRemainingButton');
    payCashButton = document.getElementById('payCashButton');
    payChequeButton = document.getElementById('payChequeButton');
    payEftposButton = document.getElementById('payEftposButton');
    payTyroButton = document.getElementById('payTyroButton');
    closePaymentModalButton = document.getElementById('close-payment-modal-button');

    // Log the state of each element
    console.log("Payment modal elements found:", {
        paymentModal: !!paymentModal,
        paymentModalSaleIdInput: !!paymentModalSaleIdInput,
        paymentModalTotalAmountSpan: !!paymentModalTotalAmountSpan,
        paymentAmountInput: !!paymentAmountInput,
        invoiceRemainingButton: !!invoiceRemainingButton,
        payCashButton: !!payCashButton,
        payChequeButton: !!payChequeButton,
        payEftposButton: !!payEftposButton,
        payTyroButton: !!payTyroButton,
        closePaymentModalButton: !!closePaymentModalButton
    });

    // Add event listeners only if elements exist
    if (payCashButton) {
        payCashButton.addEventListener('click', () => handleSubmitPayment('Cash'));
        console.log("Added click listener to payCashButton");
    }
    if (payChequeButton) {
        payChequeButton.addEventListener('click', () => handleSubmitPayment('Cheque'));
        console.log("Added click listener to payChequeButton");
    }
    if (payEftposButton) {
        payEftposButton.addEventListener('click', () => handleSubmitPayment('EFTPOS'));
        console.log("Added click listener to payEftposButton");
    }
    if (payTyroButton) {
        payTyroButton.addEventListener('click', handleTyroPayment);
        console.log("Added click listener to payTyroButton");
    }
    if (invoiceRemainingButton) {
        invoiceRemainingButton.addEventListener('click', handleInvoiceAndKeepOpen);
        console.log("Added click listener to invoiceRemainingButton");
    }
    if (closePaymentModalButton) {
        closePaymentModalButton.addEventListener('click', closePaymentModal);
        console.log("Added click listener to closePaymentModalButton");
    }

    // Add window click handler to close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (paymentModal && event.target === paymentModal) {
            closePaymentModal();
        }
    });

    console.log("Payment service initialization complete");
}

export function openPaymentModal(saleToProcess) {
    console.log("Opening payment modal for sale:", saleToProcess);
    
    // Check if elements are initialized
    if (!paymentModal) {
        console.error("Payment modal element not found");
        showToast("Cannot open payment modal - modal element not found.", "error");
        return;
    }
    if (!paymentModalSaleIdInput) {
        console.error("Payment modal sale ID input not found");
        showToast("Cannot open payment modal - sale ID input not found.", "error");
        return;
    }
    if (!paymentAmountInput) {
        console.error("Payment amount input not found");
        showToast("Cannot open payment modal - payment amount input not found.", "error");
        return;
    }
    if (!invoiceRemainingButton) {
        console.error("Invoice remaining button not found");
        showToast("Cannot open payment modal - invoice button not found.", "error");
        return;
    }
    if (!paymentModalTotalAmountSpan) {
        console.error("Payment modal total amount span not found");
        showToast("Cannot open payment modal - total amount display not found.", "error");
        return;
    }

    if (!saleToProcess || !saleToProcess.id || saleToProcess.amount_due === undefined) {
        console.error("Invalid sale data:", saleToProcess);
        showToast("Invalid sale data for payment modal.", "error");
        return;
    }

    // Set modal values
    paymentModalSaleIdInput.value = saleToProcess.id;
    paymentModalTotalAmountSpan.textContent = saleToProcess.sale_total !== undefined ? saleToProcess.sale_total.toFixed(2) : '0.00';
    paymentAmountInput.value = saleToProcess.amount_due.toFixed(2);
    
    // Show/hide invoice button based on sale status
    if (saleToProcess.status === 'Open' || saleToProcess.status === 'Quote') {
        invoiceRemainingButton.style.display = 'inline-block';
    } else {
        invoiceRemainingButton.style.display = 'none';
    }

    // Show the modal
    paymentModal.style.display = 'block';
    console.log("Payment modal opened successfully");
}

export function closePaymentModal() {
    if (paymentModal) {
        paymentModal.style.display = 'none';
    }
}

async function handleTyroPayment() {
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

    // Get Tyro terminal info from localStorage or prompt for it
    const tyroConfig = JSON.parse(localStorage.getItem('tyroConfig') || '{}');
    if (!tyroConfig.merchantId || !tyroConfig.terminalId || !tyroConfig.integrationKey) {
        // If no saved config, prompt for terminal pairing
        const merchantId = prompt("Enter Tyro Merchant ID:");
        const terminalId = prompt("Enter Tyro Terminal ID:");
        
        if (!merchantId || !terminalId) {
            showToast("Terminal pairing cancelled.", "error");
            return;
        }

        try {
            // Pair the terminal
            const pairResult = await apiCall('/payments/tyro/pair', 'POST', {
                merchant_id: merchantId,
                terminal_id: terminalId
            });

            if (!pairResult || !pairResult.integrationKey) {
                showToast("Failed to pair Tyro terminal.", "error");
                return;
            }

            // Save the configuration
            tyroConfig.merchantId = merchantId;
            tyroConfig.terminalId = terminalId;
            tyroConfig.integrationKey = pairResult.integrationKey;
            localStorage.setItem('tyroConfig', JSON.stringify(tyroConfig));
        } catch (error) {
            showToast("Error pairing terminal: " + error.message, "error");
            return;
        }
    }

    // Process the payment
    const paymentData = {
        amount: amount,
        payment_type: 'Tyro EFTPOS',
        merchant_id: tyroConfig.merchantId,
        terminal_id: tyroConfig.terminalId,
        integration_key: tyroConfig.integrationKey
    };

    try {
        const result = await apiCall(`/sales/${saleId}/payments`, 'POST', paymentData);
        if (result && result.id) {
            showToast("Tyro payment processed successfully!", "success");
            closePaymentModal();
            
            if (state.currentSale && state.currentSale.id == saleId) {
                state.currentSale = result; // Use the returned sale object directly
                updateCartDisplay();
            }
            
            loadParkedSales();
            openPrintOptionsModal(saleId, result.status, result.customer?.email);
        } else {
            showToast(result.message || "Tyro payment failed. Please try again.", "error");
        }
    } catch (error) {
        console.error("Error processing Tyro payment:", error);
        showToast("Error processing Tyro payment: " + error.message, "error");
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
        amount: amount,
        payment_type: paymentType
    };

    try {
        const result = await apiCall(`/sales/${saleId}/payments`, 'POST', paymentData);
        if (result && result.id) {
            showToast("Payment processed successfully!", "success");
            closePaymentModal();
            
            if (state.currentSale && state.currentSale.id == saleId) {
                state.currentSale = result; // Use the returned sale object directly
                updateCartDisplay();
            }
            
            loadParkedSales();
            openPrintOptionsModal(saleId, result.status, result.customer?.email);
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