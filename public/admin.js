let allUsers = [];
let allAccounts = [];
let selectedUser = null;

window.addEventListener('load', initializeAdmin);

async function initializeAdmin() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('adminName').textContent = localStorage.getItem('adminName') || 'Admin';
    await loadAllUsers();
    await loadAllAccounts();
    loadStats();
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to load users');
        
        allUsers = await response.json();
        renderUsersList(allUsers);
        updateStats();
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersList').innerHTML = '<div style="text-align: center; color: #c41e3a; padding: 20px;">Error loading users</div>';
    }
}

async function loadAllAccounts() {
    try {
        const response = await fetch('/api/debug/accounts');
        if (!response.ok) throw new Error('Failed to load accounts');
        allAccounts = await response.json();
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function renderUsersList(users) {
    const list = document.getElementById('usersList');
    list.innerHTML = '';

    if (users.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No users found</div>';
        return;
    }

    users.forEach(user => {
        const statusClass = `status-${user.status}`;
        const statusText = user.status.charAt(0).toUpperCase() + user.status.slice(1);

        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.firstName} ${user.lastName}</div>
                <div class="user-email">${user.email}</div>
                <span class="user-status ${statusClass}">${statusText}</span>
            </div>
            <div class="user-actions">
                <button class="btn-edit" onclick="openEditModal('${user.userId}')">View</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const successful = users.filter(u => u.status === 'successful').length;
        const suspended = users.filter(u => u.status === 'suspended' || u.status === 'frozen').length;

        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('activeUsers').textContent = successful;
        document.getElementById('suspendedUsers').textContent = suspended;

        const accountsResponse = await fetch('/api/admin/accounts-summary');
        if (accountsResponse.ok) {
            const data = await accountsResponse.json();
            document.getElementById('totalBalance').textContent = `$${data.totalBalance.toFixed(0)}`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStats() {
    loadStats();
}

async function fundAccount() {
    const accountNumber = document.getElementById('fundAccountNumber').value;
    const amount = parseFloat(document.getElementById('fundAmount').value);
    const description = document.getElementById('fundDescription').value;

    if (!accountNumber || !amount || amount <= 0) {
        showFundError('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch('/api/admin/fund-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNumber, amount, description })
        });

        const data = await response.json();

        if (!response.ok) {
            showFundError(data.message || 'Funding failed');
        } else {
            showFundSuccess('Account funded successfully!');
            document.getElementById('fundAccountNumber').value = '';
            document.getElementById('fundAmount').value = '';
            document.getElementById('fundDescription').value = '';
            loadStats();
            loadAllAccounts();
        }
    } catch (error) {
        showFundError('Error processing funding');
    }
}

async function debitUserAccount() {
    const accountNumber = document.getElementById('debitAccountNumber').value;
    const amount = parseFloat(document.getElementById('debitAmount').value);
    const note = document.getElementById('debitNote').value;

    if (!accountNumber || !amount || amount <= 0) {
        showDebitError('Please fill in all required fields');
        return;
    }

    try {
        const response = await fetch('/api/admin/debit-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNumber, amount, note })
        });

        const data = await response.json();

        if (!response.ok) {
            showDebitError(data.message || 'Debit failed');
        } else {
            showDebitSuccess('Account debited successfully!');
            document.getElementById('debitAccountNumber').value = '';
            document.getElementById('debitAmount').value = '';
            document.getElementById('debitNote').value = '';
            loadStats();
            loadAllAccounts();
        }
    } catch (error) {
        showDebitError('Error processing debit');
    }
}

async function openEditModal(userId) {
    const user = allUsers.find(u => u.userId === userId);
    if (!user) return;

    selectedUser = user;
    
    // Get user accounts
    const userAccounts = allAccounts.filter(a => a.userId === userId);
    
    // Build accounts display
    let accountsHTML = '';
    userAccounts.forEach(acc => {
        accountsHTML += `
            <div style="margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-radius: 6px;">
                <div style="font-weight: 600; color: #333;">${acc.accountName}</div>
                <div style="font-size: 12px; color: #666; margin-top: 3px;">Account #: ${acc.accountNumber}</div>
                <div style="font-size: 14px; color: #28a745; font-weight: 600; margin-top: 3px;">Balance: $${acc.balance.toFixed(2)}</div>
            </div>
        `;
    });

    document.getElementById('editUserId').value = user.userId;
    document.getElementById('editUserName').value = `${user.firstName} ${user.lastName}`;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPhone').value = user.phone || 'N/A';
    document.getElementById('editUserStatus').value = user.status;
    document.getElementById('editUserNote').value = user.adminNote || '';
    document.getElementById('userAccountsDisplay').innerHTML = accountsHTML;

    const authVerif = user.authVerification;
    const isAuthEnabled = authVerif && authVerif.enabled === true;
    
    document.getElementById('authToggle').checked = isAuthEnabled;
    document.getElementById('authName').value = authVerif?.authName || '';
    document.getElementById('authCode').value = authVerif?.authCode || '';
    document.getElementById('authFields').style.display = isAuthEnabled ? 'block' : 'none';

    // Display auth status
    const authStatusDiv = document.getElementById('authStatus') || createAuthStatusDiv();
    if (isAuthEnabled) {
        authStatusDiv.innerHTML = `
            <div style="padding: 10px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <div style="font-weight: 600; color: #155724;">Auth Verification Enabled</div>
                <div style="font-size: 12px; color: #155724; margin-top: 3px;">Auth Name: ${authVerif.authName}</div>
                <button onclick="toggleRemoveAuthMode()" style="margin-top: 8px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove Auth</button>
            </div>
        `;
    } else {
        authStatusDiv.innerHTML = '';
    }

    console.log('[v0] Auth loaded for user:', { userId, authVerif, isAuthEnabled });

    document.getElementById('editUserModal').classList.add('show');
}

function createAuthStatusDiv() {
    const div = document.createElement('div');
    div.id = 'authStatus';
    div.style.marginBottom = '15px';
    document.getElementById('authFields').parentElement.insertBefore(div, document.getElementById('authFields'));
    return div;
}

function toggleRemoveAuthMode() {
    document.getElementById('authToggle').checked = false;
    toggleAuthFields();
    document.getElementById('authName').value = '';
    document.getElementById('authCode').value = '';
    document.getElementById('authStatus').innerHTML = '';
}

function closeEditModal() {
    document.getElementById('editUserModal').classList.remove('show');
    selectedUser = null;
}

async function saveUserChanges() {
    if (!selectedUser) return;

    const status = document.getElementById('editUserStatus').value;
    const adminNote = document.getElementById('editUserNote').value;
    const authEnabled = document.getElementById('authToggle').checked;
    const authName = document.getElementById('authName').value;
    const authCode = document.getElementById('authCode').value;

    // Validate auth fields if enabled
    if (authEnabled && (!authName || !authCode)) {
        alert('Please enter both Auth Name and Auth Code');
        return;
    }

    const authVerification = authEnabled ? {
        enabled: true,
        authName,
        authCode
    } : {
        enabled: false,
        authName: '',
        authCode: ''
    };

    console.log('[v0] Saving auth verification:', authVerification);

    try {
        const response = await fetch(`/api/admin/user/${selectedUser.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, adminNote, authVerification })
        });

        if (response.ok) {
            console.log('[v0] Auth saved successfully');
            showFundSuccess('User updated successfully');
            closeEditModal();
            loadAllUsers();
        } else {
            showFundError('Failed to update user');
        }
    } catch (error) {
        console.error('[v0] Error saving user:', error);
        showFundError('Error updating user');
    }
}

function toggleAuthFields() {
    const authToggle = document.getElementById('authToggle');
    const authFields = document.getElementById('authFields');
    authFields.style.display = authToggle.checked ? 'block' : 'none';
}

function searchUsers() {
    const search = document.getElementById('userSearch').value.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.email.toLowerCase().includes(search) ||
        u.firstName.toLowerCase().includes(search) ||
        u.lastName.toLowerCase().includes(search)
    );
    renderUsersList(filtered);
}

function showFundSuccess(message) {
    const msg = document.getElementById('fundSuccessMsg');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

function showFundError(message) {
    const msg = document.getElementById('fundErrorMsg');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

function showDebitSuccess(message) {
    const msg = document.getElementById('debitSuccessMsg');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

function showDebitError(message) {
    const msg = document.getElementById('debitErrorMsg');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

function logoutAdmin() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        window.location.href = 'login.html';
    }
}

document.getElementById('editUserModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editUserModal') closeEditModal();
});
