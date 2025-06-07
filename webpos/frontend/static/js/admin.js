import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';

let tyroConfigModal;
let closeTyroConfigModalButton;
let tyroConfigButton;
let pairTyroTerminalButton;
let getTyroTerminalInfoButton;
let tyroMerchantIdInput;
let tyroTerminalIdInput;
let tyroPairingStatusDiv;
let tyroTerminalInfoStatusDiv;
let tyroTerminalInfoResultDiv;

export function initAdmin() {
    tyroConfigModal = document.getElementById('tyro-config-modal');
    closeTyroConfigModalButton = document.getElementById('close-tyro-config-modal');
    tyroConfigButton = document.getElementById('tyro-config-button');
    pairTyroTerminalButton = document.getElementById('pair-tyro-terminal-button');
    getTyroTerminalInfoButton = document.getElementById('get-tyro-terminal-info-button');
    tyroMerchantIdInput = document.getElementById('tyro-merchant-id');
    tyroTerminalIdInput = document.getElementById('tyro-terminal-id');
    tyroPairingStatusDiv = document.getElementById('tyro-pairing-status');
    tyroTerminalInfoStatusDiv = document.getElementById('tyro-terminal-info-status');
    tyroTerminalInfoResultDiv = document.getElementById('tyro-terminal-info-result');

    if (tyroConfigButton) {
        tyroConfigButton.addEventListener('click', openTyroConfigModal);
    }
    if (closeTyroConfigModalButton) {
        closeTyroConfigModalButton.addEventListener('click', closeTyroConfigModal);
    }
    if (pairTyroTerminalButton) {
        pairTyroTerminalButton.addEventListener('click', pairTerminal);
    }
    if (getTyroTerminalInfoButton) {
        getTyroTerminalInfoButton.addEventListener('click', getTerminalInfo);
    }

    // Load saved MID/TID from local storage
    const savedConfig = JSON.parse(localStorage.getItem('tyroConfig') || '{}');
    if (savedConfig.merchantId) {
        tyroMerchantIdInput.value = savedConfig.merchantId;
    }
    if (savedConfig.terminalId) {
        tyroTerminalIdInput.value = savedConfig.terminalId;
    }
}

function openTyroConfigModal() {
    if (tyroConfigModal) {
        tyroConfigModal.style.display = 'block';
    }
}

function closeTyroConfigModal() {
    if (tyroConfigModal) {
        tyroConfigModal.style.display = 'none';
    }
}

async function pairTerminal() {
    const merchantId = tyroMerchantIdInput.value;
    const terminalId = tyroTerminalIdInput.value;

    if (!merchantId || !terminalId) {
        showToast("Merchant ID and Terminal ID are required.", "error");
        return;
    }

    tyroPairingStatusDiv.textContent = "Pairing in progress...";
    tyroPairingStatusDiv.style.color = 'orange';

    try {
        const result = await apiCall('/payments/tyro/pair', 'POST', {
            merchant_id: merchantId,
            terminal_id: terminalId
        });

        if (result && result.status === 'success') {
            tyroPairingStatusDiv.textContent = `Pairing successful: ${result.message}`;
            tyroPairingStatusDiv.style.color = 'green';
            showToast("Tyro terminal paired successfully!", "success");

            // Save the successful config
            const tyroConfig = {
                merchantId: merchantId,
                terminalId: terminalId,
                integrationKey: result.integrationKey
            };
            localStorage.setItem('tyroConfig', JSON.stringify(tyroConfig));

        } else {
            const errorMessage = result ? result.message : "Unknown error";
            tyroPairingStatusDiv.textContent = `Pairing failed: ${errorMessage}`;
            tyroPairingStatusDiv.style.color = 'red';
            showToast(`Pairing failed: ${errorMessage}`, "error");
        }
    } catch (error) {
        tyroPairingStatusDiv.textContent = `Pairing failed: ${error.message}`;
        tyroPairingStatusDiv.style.color = 'red';
        showToast(`Pairing error: ${error.message}`, "error");
    }
}

async function getTerminalInfo() {
    const savedConfig = JSON.parse(localStorage.getItem('tyroConfig') || '{}');
    if (!savedConfig.merchantId || !savedConfig.terminalId || !savedConfig.integrationKey) {
        showToast("Terminal not paired or configuration is missing.", "error");
        tyroTerminalInfoStatusDiv.textContent = "Error: Terminal not paired.";
        tyroTerminalInfoStatusDiv.style.color = 'red';
        return;
    }

    tyroTerminalInfoStatusDiv.textContent = "Fetching terminal info...";
    tyroTerminalInfoStatusDiv.style.color = 'orange';
    tyroTerminalInfoResultDiv.innerHTML = '';

    try {
        const result = await apiCall('/payments/tyro/terminal-info', 'GET', null, {
            merchant_id: savedConfig.merchantId,
            terminal_id: savedConfig.terminalId,
            integration_key: savedConfig.integrationKey
        });

        if (result && result.terminalInfo) {
            tyroTerminalInfoStatusDiv.textContent = "Terminal info retrieved successfully.";
            tyroTerminalInfoStatusDiv.style.color = 'green';
            
            let table = '<table>';
            for (const [key, value] of Object.entries(result.terminalInfo)) {
                table += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
            table += '</table>';
            tyroTerminalInfoResultDiv.innerHTML = table;
        } else {
            const errorMessage = result ? result.error : "Unknown error";
            tyroTerminalInfoStatusDiv.textContent = `Failed to get info: ${errorMessage}`;
            tyroTerminalInfoStatusDiv.style.color = 'red';
        }
    } catch (error) {
        tyroTerminalInfoStatusDiv.textContent = `Error fetching info: ${error.message}`;
        tyroTerminalInfoStatusDiv.style.color = 'red';
    }
} 