let currentUser = null;
let userAccounts = [];
let userTransactions = [];
let unreadNotifications = 0;

// Initialize app on load
window.addEventListener('load', initializeApp);

async function initializeApp() {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');

    // Check if admin is logged in instead
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
        window.location.href = 'admin.html';
        return;
    }

    if (!token || !userId) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Load user data with token
        const userResponse = await fetch(`/api/user/${userId}`, {
            headers: {
                'Authorization': token
            }
        });
        
        if (!userResponse.ok) throw new Error('Failed to load user');
        currentUser = await userResponse.json();

        // Load accounts with token
        const accountsResponse = await fetch(`/api/accounts/${userId}`, {
            headers: {
                'Authorization': token
            }
        });
        
        if (!accountsResponse.ok) throw new Error('Failed to load accounts');
        userAccounts = await accountsResponse.json();

        // Load transactions with token
        const transResponse = await fetch(`/api/transactions/${userId}`, {
            headers: {
                'Authorization': token
            }
        });
        
        if (!transResponse.ok) throw new Error('Failed to load transactions');
        userTransactions = await transResponse.json();

        // Load notifications
        await loadNotifications();

        // Render UI
        renderGreeting();
        renderAccounts();
        renderDashboard();
        updateNotificationBadge();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading app:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        window.location.href = 'login.html';
    }
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Header buttons
    document.getElementById('notificationBtn').addEventListener('click', openNotifications);
    document.getElementById('profileBtn').addEventListener('click', () => window.location.href = 'profile.html');
    document.getElementById('menuBtn').addEventListener('click', openMenu);
    
    // Back button
    document.getElementById('headerBack').addEventListener('click', goBack);
}

async function loadNotifications() {
    try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`/api/notifications/${userId}/unread-count`, {
            headers: { 'Authorization': token }
        });
        
        if (response.ok) {
            const data = await response.json();
            unreadNotifications = data.unreadCount;
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function updateNotificationBadge() {
    // You can add a badge to the notification button if needed
    console.log('Unread notifications:', unreadNotifications);
}

function renderGreeting() {
    const greeting = `Hello, ${currentUser.firstName}!`;
    document.getElementById('greetingName').textContent = greeting;
    document.getElementById('dashboardGreeting').textContent = greeting;

    // Show status badge
    const statusBadge = document.getElementById('statusBadge');
    let statusClass = currentUser.status;
    let statusText = currentUser.status.charAt(0).toUpperCase() + currentUser.status.slice(1);
    
    statusBadge.innerHTML = `<div class="status-badge ${statusClass}">${statusText}</div>`;

    // Show admin note if account is suspended/frozen
    if ((currentUser.status === 'suspended' || currentUser.status === 'frozen') && currentUser.adminNote) {
        const alert = document.getElementById('userAlert');
        document.getElementById('alertMessage').textContent = currentUser.adminNote;
        alert.classList.add('show');
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function renderAccounts() {
    const accountsList = document.getElementById('accountsList');
    accountsList.innerHTML = '';

    if (userAccounts.length === 0) {
        accountsList.innerHTML = `
            <div class="info-card">
                <div class="info-card-title">No Accounts Found</div>
                <div>You don't have any accounts yet. Please contact support.</div>
            </div>
        `;
        return;
    }

    userAccounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'account-card';
        card.onclick = () => viewAccount(account.accountId);
        
        card.innerHTML = `
            <div class="account-info">
                <div class="account-icon">${account.icon}</div>
                <div class="account-name">${account.accountName}</div>
                <div class="account-number">${account.accountNumber}</div>
            </div>
            <div class="account-balance">
                <div class="balance-label">Available Balance</div>
                <div class="balance-amount">$${formatNumber(account.availableBalance.toFixed(2))}</div>
            </div>
            <div class="account-actions">
                <button class="btn-view" onclick="event.stopPropagation(); viewAccount('${account.accountId}')">VIEW</button>
            </div>
        `;
        
        accountsList.appendChild(card);
    });
}

function renderDashboard() {
    // Account summary cards
    const summary = document.getElementById('dashboardSummary');
    summary.innerHTML = '';

    const totalBalance = userAccounts.reduce((sum, acc) => sum + acc.balance, 0);

    let summaryHTML = `
        <div class="account-card">
            <div class="account-info">
                <div class="account-icon">💰</div>
                <div>
                    <div class="account-name">Total Balance</div>
                    <div class="account-number">All Accounts</div>
                </div>
            </div>
            <div class="account-balance">
                <div class="balance-label">Net Worth</div>
                <div class="balance-amount">$${formatNumber(totalBalance.toFixed(2))}</div>
            </div>
        </div>
    `;

    userAccounts.forEach(acc => {
        summaryHTML += `
            <div class="account-card">
                <div class="account-info">
                    <div class="account-icon">${acc.icon}</div>
                    <div>
                        <div class="account-name">${acc.accountName}</div>
                        <div class="account-number">${acc.accountNumber}</div>
                    </div>
                </div>
                <div class="account-balance">
                    <div class="balance-label">Current Balance</div>
                    <div class="balance-amount">$${formatNumber(acc.balance.toFixed(2))}</div>
                </div>
            </div>
        `;
    });

    summary.innerHTML = summaryHTML;

    // Recent transactions
    const recent = document.getElementById('recentActivity');
    recent.innerHTML = '';

    if (userTransactions.length === 0) {
        recent.innerHTML = `
            <div class="info-card">
                <div class="info-card-title">No Recent Activity</div>
                <div>Your transactions will appear here</div>
            </div>
        `;
    } else {
        userTransactions.slice(0, 5).forEach(trans => {
            const date = new Date(trans.timestamp).toLocaleDateString();
            const isDebit = trans.fromUserId === currentUser.userId;
            const icon = isDebit ? '📤' : '📥';
            const type = isDebit ? 'Sent' : 'Received';
            
            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.cursor = 'pointer';
            item.onclick = () => viewTransaction(trans.transactionId);
            
            item.innerHTML = `
                <div class="account-info">
                    <div class="account-icon">${icon}</div>
                    <div>
                        <div class="account-name">${type} - ${trans.type}</div>
                        <div class="account-number">${date}</div>
                    </div>
                </div>
                <div class="account-balance">
                    <div class="balance-label">Amount</div>
                    <div class="balance-amount" style="color: ${isDebit ? '#c41e3a' : '#28a745'}">
                        ${isDebit ? '-' : '+'}$${formatNumber(trans.amount.toFixed(2))}
                    </div>
                </div>
            `;
            
            recent.appendChild(item);
        });
    }
}

function switchTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));

    // Show selected tab
    document.getElementById(tab).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Show/hide back button based on tab
    const headerBack = document.getElementById('headerBack');
    if (tab === 'dashboard') {
        headerBack.classList.add('show');
    } else {
        headerBack.classList.remove('show');
    }

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (tab === 'accounts') {
        document.getElementById('accountsNav').classList.add('active');
    }
}

function viewAccount(accountId) {
    const account = userAccounts.find(a => a.accountId === accountId);
    if (account) {
        localStorage.setItem('selectedAccount', JSON.stringify(account));
        window.location.href = 'account-details.html';
    }
}

function viewTransaction(transactionId) {
    const transaction = userTransactions.find(t => t.transactionId === transactionId);
    if (transaction) {
        showTransactionReceipt(transaction);
    }
}

function showTransactionReceipt(transaction) {
    const isDebit = transaction.fromUserId === currentUser.userId;
    const date = new Date(transaction.timestamp).toLocaleString();
    
    const receipt = `
Transaction Details:
─────────────────
ID: ${transaction.transactionId}
Amount: $${transaction.amount.toFixed(2)}
Type: ${transaction.type.toUpperCase()}
Status: ${transaction.status}
Date: ${date}
${isDebit ? `To: ${transaction.toUserName || transaction.recipientName}` : `From: ${transaction.fromUserName}`}
Description: ${transaction.description || 'N/A'}
    `;
    
    alert(receipt);
}

function openNotifications() {
    window.location.href = 'notifications.html';
}

function openPage(page) {
    if (page === 'transfer-page') {
        window.location.href = 'transfer-page.html';
    } else if (page === 'transactions-page') {
        window.location.href = 'transactions.html';
    } else if (page === 'request-page') {
        window.location.href = 'request-money.html';
    } else if (page === 'profile.html') {
        window.location.href = 'profile.html';
    }
}

function openMenu() {
    const choice = prompt('Menu Options:\n1. Profile\n2. Transactions\n3. Notifications\n4. Settings\n5. Logout\n6. Admin Panel');
    if (choice === '1') {
        window.location.href = 'profile.html';
    } else if (choice === '2') {
        window.location.href = 'transactions.html';
    } else if (choice === '3') {
        window.location.href = 'notifications.html';
    } else if (choice === '4') {
        alert('Settings page coming soon');
    } else if (choice === '5') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        window.location.href = 'login.html';
    } else if (choice === '6') {
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
            window.location.href = 'admin.html';
        } else {
            alert('Admin access required. Redirecting to login...');
            window.location.href = 'login.html';
        }
    }
}

function goBack() {
    switchTab('accounts');
}

// Auto-refresh data every 30 seconds
setInterval(() => {
    if (currentUser) {
        initializeApp();
    }
}, 30000);
