let currentStep = 1;
let transferData = {
    fromAccount: null,
    method: null,
    recipientAccount: null,
    amount: null,
    description: null,
    zelleData: null
};

let userAccounts = [];
let currentUser = null;
let pendingTransfer = null;

window.addEventListener('load', async function() {
    await loadAccounts();
    await loadCurrentUser();
});

async function loadCurrentUser() {
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(`/api/user/${userId}`);
        currentUser = await response.json();
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function loadAccounts() {
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(`/api/accounts/${userId}`);
        userAccounts = await response.json();
        
        const select = document.getElementById('fromAccount');
        select.innerHTML = '<option value="">Select account...</option>';
        
        userAccounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.accountId;
            option.textContent = `${acc.accountName} - $${acc.balance.toFixed(2)} (${acc.accountNumber})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function selectPaymentMethod(element, method) {
    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    transferData.method = method;

    if (method === 'zelle') {
        document.getElementById('zelleFields').style.display = 'block';
        document.getElementById('standardFields').style.display = 'none';
    } else {
        document.getElementById('zelleFields').style.display = 'none';
        document.getElementById('standardFields').style.display = 'block';
    }
}

function updateAmountDisplay() {
    let amount;
    if (transferData.method === 'zelle') {
        amount = parseFloat(document.getElementById('zelleAmount').value);
    } else {
        amount = parseFloat(document.getElementById('amount').value);
    }

    if (amount > 0) {
        document.getElementById('amountDisplay').style.display = 'block';
        document.getElementById('amountValue').textContent = `$${amount.toFixed(2)}`;
        transferData.amount = amount;
    }
}

function nextStep(step) {
    if (step === 1) {
        if (!document.getElementById('fromAccount').value) {
            document.getElementById('error1').textContent = 'Please select an account';
            document.getElementById('error1').classList.add('show');
            return;
        }
        transferData.fromAccount = document.getElementById('fromAccount').value;
    } else if (step === 2) {
        if (!transferData.method) {
            alert('Please select a payment method');
            return;
        }
    } else if (step === 3) {
        if (transferData.method === 'zelle') {
            const name = document.getElementById('zelleRecipientName').value;
            const phone = document.getElementById('zellePhone').value;
            const email = document.getElementById('zelleEmail').value;
            const amount = document.getElementById('zelleAmount').value;

            if (!name || !phone || !email || !amount) {
                alert('Please fill in all required Zelle fields');
                return;
            }

            transferData.zelleData = {
                name,
                phone,
                email,
                amount: parseFloat(amount),
                note: document.getElementById('zelleNote').value || ''
            };
            transferData.amount = parseFloat(amount);

            // Show Zelle receipt
            showZelleReceipt();
            return;
        } else {
            if (!document.getElementById('recipientAccount').value || !document.getElementById('amount').value) {
                document.getElementById('error3').textContent = 'Please fill in all fields';
                document.getElementById('error3').classList.add('show');
                return;
            }
            transferData.recipientAccount = document.getElementById('recipientAccount').value;
            transferData.description = document.getElementById('description').value;
            updateReview();
        }
    }

    document.getElementById(`section${currentStep}`).classList.remove('active');
    document.getElementById(`step${currentStep}`).classList.add('completed');
    document.getElementById(`step${currentStep}`).classList.remove('active');

    currentStep = step + 1;
    document.getElementById(`section${currentStep}`).classList.add('active');
    document.getElementById(`step${currentStep}`).classList.add('active');
}

function prevStep(step) {
    document.getElementById(`section${currentStep}`).classList.remove('active');
    currentStep = step - 1;
    document.getElementById(`section${currentStep}`).classList.add('active');
    document.getElementById(`step${step}`).classList.remove('completed');
    document.getElementById(`step${step}`).classList.remove('active');
    document.getElementById(`step${currentStep}`).classList.add('active');
}

function showZelleReceipt() {
    const data = transferData.zelleData;
    
    const initial = data.name.charAt(0).toUpperCase();
    document.getElementById('zelleAvatar').textContent = initial;
    
    document.getElementById('zelleReceiptAmount').textContent = `$${data.amount.toFixed(2)}`;
    document.getElementById('zelleReceiptName').textContent = data.name;
    document.getElementById('zelleReceiptPhone').textContent = data.phone;
    document.getElementById('zelleReceiptEnrolled').textContent = `Enrolled with Zelle® as ${data.name.toUpperCase()}`;
    document.getElementById('zelleReceiptNote').textContent = data.note || '';
    
    document.getElementById('zelleReceiptModal').classList.add('show');
}

function closeZelleReceipt() {
    document.getElementById('zelleReceiptModal').classList.remove('show');
}

async function confirmZelleTransfer() {
    if (currentUser && currentUser.authVerification && currentUser.authVerification.enabled === true) {
        pendingTransfer = { type: 'zelle' };
        showAuthModal();
    } else {
        await executeZelleTransfer();
    }
}

async function executeZelleTransfer() {
    try {
        const fromAccountId = transferData.fromAccount;
        const amount = transferData.zelleData.amount;
        const description = `Zelle to ${transferData.zelleData.name} (${transferData.zelleData.phone}) - ${transferData.zelleData.note}`;

        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAccountId,
                toAccountNumber: null,
                amount,
                type: 'zelle',
                description,
                zelleData: transferData.zelleData
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeZelleReceipt();
            showTransactionSuccess('Zelle Transfer Completed');
        } else {
            alert('❌ Transfer failed: ' + data.message);
        }
    } catch (error) {
        console.error('Transfer error:', error);
        alert('❌ Transfer failed: Network error');
    }
}

function updateReview() {
    const fromAcc = userAccounts.find(a => a.accountId === transferData.fromAccount);
    document.getElementById('reviewFrom').textContent = `${fromAcc.accountName} - $${fromAcc.balance.toFixed(2)}`;
    document.getElementById('reviewTo').textContent = transferData.recipientAccount;
    document.getElementById('reviewAmount').textContent = `$${parseFloat(transferData.amount).toFixed(2)}`;
    document.getElementById('reviewDescription').textContent = transferData.description || 'No description';
}

async function submitTransfer() {
    if (currentUser && currentUser.authVerification && currentUser.authVerification.enabled === true) {
        pendingTransfer = { type: 'standard' };
        showAuthModal();
    } else {
        await executeStandardTransfer();
    }
}

async function executeStandardTransfer() {
    try {
        const fromAccountId = transferData.fromAccount;
        const toAccountNumber = transferData.recipientAccount;
        const amount = transferData.amount;
        const type = transferData.method;
        const description = transferData.description;

        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAccountId,
                toAccountNumber,
                amount: parseFloat(amount),
                type,
                description
            })
        });

        const data = await response.json();

        if (response.ok) {
            showTransactionSuccess('Transfer Completed Successfully');
        } else {
            alert('❌ Transfer failed: ' + data.message);
        }
    } catch (error) {
        console.error('Transfer error:', error);
        alert('❌ Transfer failed: Network error');
    }
}

function showTransactionSuccess(title) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successAmount').textContent = `$${transferData.amount.toFixed(2)}`;
    document.getElementById('successModal').classList.add('show');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('show');
    // Reset and go back to accounts page
    window.location.href = 'app.html';
}

function showAuthModal() {
    document.getElementById('authNameDisplay').textContent = currentUser.authVerification.authName;
    document.getElementById('authModalTitle').textContent = `${currentUser.authVerification.authName} Required`;
    document.getElementById('authCodeInput').value = '';
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authModal').classList.add('show');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('show');
    pendingTransfer = null;
}

async function verifyAuthCode() {
    const enteredCode = document.getElementById('authCodeInput').value;
    const correctCode = currentUser.authVerification.authCode;

    if (enteredCode === correctCode) {
        closeAuthModal();
        
        // Execute pending transfer based on type
        if (pendingTransfer.type === 'zelle') {
            await executeZelleTransfer();
        } else {
            await executeStandardTransfer();
        }
    } else {
        document.getElementById('authError').textContent = 'Invalid authentication code';
        document.getElementById('authError').classList.add('show');
    }
}

async function lookupRecipient() {
    const accountInput = document.getElementById('recipientAccount').value;
    
    if (!accountInput || accountInput.length < 10) {
        document.getElementById('recipientInfo').classList.remove('show');
        return;
    }

    try {
        const response = await fetch(`/api/verify-account/${accountInput}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('recipientName').textContent = data.userName;
            document.getElementById('recipientAccount2').textContent = `Account: ${data.accountName} (${data.accountNumber})`;
            document.getElementById('recipientInfo').classList.add('show');
        } else {
            document.getElementById('recipientInfo').classList.remove('show');
        }
    } catch (error) {
        console.error('Lookup error:', error);
        document.getElementById('recipientInfo').classList.remove('show');
    }
}

function updateStep() {
}

function goBack() {
    if (document.getElementById('zelleReceiptModal').classList.contains('show')) {
        closeZelleReceipt();
    } else if (document.getElementById('successModal').classList.contains('show')) {
        closeSuccessModal();
    } else {
        window.history.back();
    }
}

function openMenu() {
    alert('Menu options');
}
