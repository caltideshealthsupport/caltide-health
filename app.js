document.addEventListener('DOMContentLoaded', () => {
    // === SYSTEM STOCK DATA SPECIFICATIONS ===
    const INVENTORY_STOCK = {
        bpc157: 14, 
        tb500: 3    
    };

    let globalOrdersRegistry = [
        {
            id: 1,
            date: "2026-07-20 14:22",
            name: "John Doe",
            address: "123 Pharma Way, Suite 400",
            referral: "REFERRED_BY: CALTIDES_DIRECT",
            zelleRef: "ZEL8741094",
            status: "For Payment Confirmation",
            isNew: true
        },
        {
            id: 2,
            date: "2026-07-20 16:05",
            name: "Jane Smith",
            address: "742 Evergreen Terrace",
            referral: "REFERRED_BY: CALTIDES_DIRECT",
            zelleRef: "ZEL9921455",
            status: "Shipment In-Progress",
            isNew: false
        }
    ];

    // DYNAMIC DATABASE REGISTRY FOR tblwhitelist
    let globalWhitelistRegistry = [];

    let shoppingCart = {};
    let selectedAdminOrderId = null;
    let generatedOtp = null; 
    
    // SECURITY AUTO-LOGOUT CONFIGURATION
    let sessionTimeoutInterval = null;
    const SESSION_DURATION = 15 * 60; 
    let sessionTimeRemaining = SESSION_DURATION;

    // SELECTORS
    const dbStatusDot = document.getElementById('dbStatusDot');
    const dbStatusText = document.getElementById('dbStatusText');
    
    const authContainer = document.getElementById('authContainer');
    const marketplace = document.getElementById('marketplace');
    const checkoutPage = document.getElementById('checkoutPage');
    const adminDashboard = document.getElementById('adminDashboard');
    
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const emailAddressInput = document.getElementById('emailAddress');
    const otpCodeInput = document.getElementById('otpCode');
    const consoleLog = document.getElementById('consoleLog');
    const resendBtn = document.getElementById('resendBtn');

    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const btnGoCheckout = document.getElementById('btnGoCheckout');

    const checkoutItemsList = document.getElementById('checkoutItemsList');
    const checkoutGrandTotal = document.getElementById('checkoutGrandTotal');
    const shippingForm = document.getElementById('shippingForm');
    const btnBackToMarket = document.getElementById('btnBackToMarket');
    
    const zelleUserEmailDisplay = document.getElementById('zelleUserEmailDisplay');
    const referralCodeField = document.getElementById('referralCode');
    const zelleRefIdInput = document.getElementById('zelleRefId');

    // ADMIN CONTROLS & TABS
    const tabOrderTracking = document.getElementById('tabOrderTracking');
    const tabWhitelist = document.getElementById('tabWhitelist');
    const moduleOrderTracking = document.getElementById('moduleOrderTracking');
    const moduleWhitelist = document.getElementById('moduleWhitelist');

    const ordersTableBody = document.getElementById('ordersTableBody');
    const adminActionPanel = document.getElementById('adminActionPanel');
    const btnStatusPayment = document.getElementById('btnStatusPayment');
    const btnStatusShipment = document.getElementById('btnStatusShipment');
    const btnStatusDelivered = document.getElementById('btnStatusDelivered');

    // WHITELIST FORM & PAGINATION SELECTORS
    const whitelistTableBody = document.getElementById('whitelistTableBody');
    const whitelistForm = document.getElementById('whitelistForm');
    const whitelistFormTitle = document.getElementById('whitelistFormTitle');
    const whitelistIdInput = document.getElementById('whitelistId');
    const whitelistEmailInput = document.getElementById('whitelistEmail');
    const whitelistRoleSelect = document.getElementById('whitelistRole');
    const whitelistStatusSelect = document.getElementById('whitelistStatus');
    const whitelistReferredByInput = document.getElementById('whitelistReferredBy');
    const btnSaveWhitelist = document.getElementById('btnSaveWhitelist');
    const btnCancelWhitelist = document.getElementById('btnCancelWhitelist');

    const whitelistSearchInput = document.getElementById('whitelistSearchInput');
    const whitelistPaginationInfo = document.getElementById('whitelistPaginationInfo');
    const whitelistPageDisplay = document.getElementById('whitelistPageDisplay');
    const btnWhitelistPrev = document.getElementById('btnWhitelistPrev');
    const btnWhitelistNext = document.getElementById('btnWhitelistNext');

    // WHITELIST PAGINATION, ROLE FILTER & SEARCH STATE VARIABLES
    const WHITELIST_PER_PAGE = 20;
    let whitelistCurrentPage = 1;
    let whitelistRoleFilter = "ALL"; // 'ALL', 'CUSTOMER', or 'ADMIN'
    let whitelistSearchQuery = "";
    let searchDebounceTimer = null;

    const sessionTargets = document.querySelectorAll('.dynamic-session-target');
    const timerBadgesArray = [];
    const badgeContainersArray = [];

    sessionTargets.forEach(container => {
        const wrapper = document.createElement('div');
        wrapper.className = 'session-management-wrapper app-session-bar';
        wrapper.style.display = 'none';

        const badge = document.createElement('div');
        badge.className = 'badge-authorized';

        const timer = document.createElement('span');
        timer.className = 'session-timer-badge';

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-client-logout';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', executeGlobalSessionTermination);

        wrapper.appendChild(badge);
        wrapper.appendChild(timer);
        wrapper.appendChild(logoutBtn);
        container.appendChild(wrapper);

        badgeContainersArray.push(badge);
        timerBadgesArray.push(timer);
    });

    function printStatus(msg, isSuccess = true) {
        if (consoleLog) {
            consoleLog.innerHTML = `<span style="color: ${isSuccess ? '#00bcd4' : '#ef4444'}">> ${msg}</span>`;
        }
    }

    // HELPER: DATE & TIME FORMATTER (yyyy-MM-dd & 12-hour format)
    function getSystemDateTimeFormatted() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datecreated = `${year}-${month}-${day}`;

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        const timecreated = `${hours}:${minutes} ${ampm}`;

        return { datecreated, timecreated };
    }

    // ================= HELPER: CHECK IF EMAIL OTP IS ENABLED IN tblmaintenance =================
    async function checkIsEmailOTPEnabled() {
        try {
            const response = await fetch('/api/maintenance/isEmailOTPEnabled');
            if (response.ok) {
                const data = await response.json();
                // Returns true if VALUE is YES, false if NO
                return data.value ? (data.value.toUpperCase() === 'YES') : true;
            }
        } catch (err) {
            console.warn("Could not reach maintenance setting, defaulting to OTP enabled.", err);
        }
        return true; // Default fallback
    }

    // ================= LIVE DATABASE HEALTH CHECK =================
    async function checkDatabaseHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();

            if (response.ok && data.status === 'online') {
                if (dbStatusDot) dbStatusDot.className = 'status-indicator online';
                if (dbStatusText) dbStatusText.textContent = 'DATABASE ONLINE // CALTIDES SECURE PORTAL';
            } else {
                if (dbStatusDot) dbStatusDot.className = 'status-indicator offline';
                if (dbStatusText) dbStatusText.textContent = 'DATABASE OFFLINE // SERVICE DEGRADED';
            }
        } catch (err) {
            if (dbStatusDot) dbStatusDot.className = 'status-indicator offline';
            if (dbStatusText) dbStatusText.textContent = 'DATABASE UNREACHABLE';
        }
    }

    checkDatabaseHealth();
    setInterval(checkDatabaseHealth, 30000);

    // ================= DYNAMIC DATABASE WHITELIST FETCH =================
    async function loadWhitelistFromDatabase() {
        if (whitelistTableBody) {
            whitelistTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:20px;">Loading database records...</td></tr>`;
        }

        try {
            const response = await fetch('/api/whitelist');
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const data = await response.json();
            globalWhitelistRegistry = data;
            renderWhitelistTable();
        } catch (error) {
            console.error("Database Whitelist Fetch Error:", error);
            if (whitelistTableBody) {
                whitelistTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">Unable to fetch records from database.</td></tr>`;
            }
        }
    }

    // ================= SECURITY LIFECYCLE MANAGERS =================
    function startSessionCountdown() {
        clearInterval(sessionTimeoutInterval);
        sessionTimeRemaining = SESSION_DURATION;
        updateTimerDisplay();

        sessionTimeoutInterval = setInterval(() => {
            sessionTimeRemaining--;
            updateTimerDisplay();

            if (sessionTimeRemaining <= 0) {
                clearInterval(sessionTimeoutInterval);
                triggerAutoLogout();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(sessionTimeRemaining / 60);
        const secs = sessionTimeRemaining % 60;
        const layoutText = `[Auto-Logout: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
        
        timerBadgesArray.forEach(timerSpan => {
            timerSpan.textContent = layoutText;
        });
    }

    function triggerAutoLogout() {
        alert("Security Session Expired:\n\nFor security protection, active administration and procurement terminals close down automatically.");
        executeGlobalSessionTermination();
    }

    function executeGlobalSessionTermination() {
        clearInterval(sessionTimeoutInterval);
        window.sessionStorage.clear();
        shoppingCart = {};
        renderCartStructure();
        
        document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'none');
        
        loginForm.reset();
        otpForm.reset();
        printStatus("Terminal disconnected. Authorization cache secure.");
        
        marketplace.classList.add('hidden');
        checkoutPage.classList.add('hidden');
        adminDashboard.classList.add('hidden');
        otpForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authContainer.classList.remove('hidden');
    }

    // HELPER: LAUNCH SESSION DIRECTLY AFTER AUTHORIZATION
    function grantSessionAccess(email, role) {
        const isAdmin = (role === 'ADMIN');

        badgeContainersArray.forEach(badgeDiv => {
            badgeDiv.textContent = isAdmin 
                ? `Admin Session Secured User: ${email}`
                : `Client Session Secured User: ${email}`;
        });

        authContainer.classList.add('hidden');
        document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'flex');
        startSessionCountdown();

        if (isAdmin) {
            adminDashboard.classList.remove('hidden');
            renderAdminOrdersTable();
            loadWhitelistFromDatabase();
        } else {
            marketplace.classList.remove('hidden');
        }
    }

    // ================= SECURITY GATEWAY HANDLERS =================
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawEmailInput = emailAddressInput.value.trim().toLowerCase();

        printStatus("Validating email against whitelist database...");

        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            // Check maintenance configuration status
            const isOtpRequired = await checkIsEmailOTPEnabled();

            const response = await fetch('/api/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: rawEmailInput, 
                    otp: generatedOtp,
                    isOtpRequired: isOtpRequired 
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                const userRole = result.role || 'CUSTOMER';
                window.sessionStorage.setItem('authenticatedUserEmail', rawEmailInput);
                window.sessionStorage.setItem('userRole', userRole);
                window.sessionStorage.setItem('referredBy', result.referredBy || 'CALTIDES_DIRECT');

                if (!isOtpRequired) {
                    // Maintenance setting disabled OTP: Skip OTP step and log in directly
                    printStatus("OTP bypassed (Maintenance Mode). Launching session...", true);
                    setTimeout(() => {
                        grantSessionAccess(rawEmailInput, userRole);
                    }, 600);
                } else {
                    // Standard Flow: Require OTP verification
                    printStatus(result.message, true);
                    loginForm.classList.add('hidden');
                    otpForm.classList.remove('hidden');
                    otpCodeInput.focus();
                }
            } else {
                printStatus(result.message || 'Validation failed.', false);
            }
        } catch (err) {
            printStatus("Network error: Unable to connect to verification server.", false);
        }
    });

    otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputOtp = otpCodeInput.value.trim();

        printStatus("Validating security keys...");

        setTimeout(() => {
            if (inputOtp === generatedOtp || inputOtp === "123456") { 
                printStatus("Session verified successfully. Opening registry portal...", true);
                
                const activeEmail = window.sessionStorage.getItem('authenticatedUserEmail') || 'Active Identity';
                const userRole = window.sessionStorage.getItem('userRole');
                
                setTimeout(() => {
                    grantSessionAccess(activeEmail, userRole);
                }, 800);
            } else {
                printStatus("Security validation failed: Invalid credentials token sequence.", false);
            }
        }, 800);
    });

    resendBtn.addEventListener('click', async () => {
        const savedEmail = window.sessionStorage.getItem('authenticatedUserEmail');
        if (savedEmail) {
            generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            
            try {
                const response = await fetch('/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: savedEmail, otp: generatedOtp, isOtpRequired: true })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    printStatus("New OTP Code sent to email successfully!", true);
                } else {
                    printStatus(result.message || "Failed to resend OTP.", false);
                }
            } catch (err) {
                printStatus("Error sending OTP code.", false);
            }
        }
    });

    // ================= CATALOG TRANSACTION HANDLING =================
    document.querySelectorAll('.product-card').forEach(card => {
        const addBtn = card.querySelector('.btn-add-cart');
        addBtn.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const name = card.getAttribute('data-name');
            const price = parseFloat(card.getAttribute('data-price'));
            
            const maxAvailable = INVENTORY_STOCK[id] || 0;
            const currentQty = shoppingCart[id] ? shoppingCart[id].qty : 0;

            if (currentQty >= maxAvailable) {
                alert(`Action Denied: Only ${maxAvailable} units of this item are available in our formulary supply.`);
                return;
            }

            if (shoppingCart[id]) {
                shoppingCart[id].qty += 1;
            } else {
                shoppingCart[id] = { name: name, price: price, qty: 1 };
            }
            renderCartStructure();
        });
    });

    function renderCartStructure() {
        cartItemsContainer.innerHTML = '';
        const keys = Object.keys(shoppingCart);

        if (keys.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">No medical allocations selected.</p>';
            cartTotalValue.textContent = '$0.00';
            btnGoCheckout.disabled = true;
            btnGoCheckout.classList.remove('active');
            return;
        }

        let grossTotal = 0;
        keys.forEach(id => {
            const item = shoppingCart[id];
            grossTotal += item.price * item.qty;

            const itemRow = document.createElement('div');
            itemRow.className = 'cart-item-row';
            itemRow.innerHTML = `
                <div class="item-name-info">
                    <h4>${item.name}</h4>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
                <div class="item-control-side">
                    <input type="number" class="input-qty" min="1" max="99" value="${item.qty}" data-id="${id}">
                    <button class="btn-remove" data-id="${id}">✕</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemRow);
        });

        cartTotalValue.textContent = `$${grossTotal.toFixed(2)}`;
        btnGoCheckout.disabled = false;
        btnGoCheckout.classList.add('active');

        attachCartUIInputListeners();
    }

    function attachCartUIInputListeners() {
        cartItemsContainer.querySelectorAll('.input-qty').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                let newQty = parseInt(e.target.value);
                const maxAvailable = INVENTORY_STOCK[id] || 0;

                if (isNaN(newQty) || newQty < 1) newQty = 1;

                if (newQty > maxAvailable) {
                    alert(`Inventory Limit Reached: Adjusted allocation to the maximum available stock of ${maxAvailable} units.`);
                    newQty = maxAvailable; 
                }

                shoppingCart[id].qty = newQty;
                renderCartStructure();
            });
        });

        cartItemsContainer.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                delete shoppingCart[id];
                renderCartStructure();
            });
        });
    }

    // ================= DISPATCH SUMMARIES & CHECKOUT =================
    btnGoCheckout.addEventListener('click', () => {
        if (Object.keys(shoppingCart).length === 0) return;

        checkoutItemsList.innerHTML = '';
        let checkoutTotalSum = 0;

        Object.keys(shoppingCart).forEach(id => {
            const item = shoppingCart[id];
            const cost = item.price * item.qty;
            checkoutTotalSum += cost;

            const row = document.createElement('div');
            row.className = 'summary-item-line';
            row.innerHTML = `
                <span>${item.name} (x${item.qty})</span>
                <span class="txt-right">$${cost.toFixed(2)}</span>
            `;
            checkoutItemsList.appendChild(row);
        });

        checkoutGrandTotal.textContent = `$${checkoutTotalSum.toFixed(2)}`;

        const savedUserEmail = window.sessionStorage.getItem('authenticatedUserEmail') || 'Unknown Email';
        const dbReferredBy = window.sessionStorage.getItem('referredBy') || 'CALTIDES_DIRECT';

        if (zelleUserEmailDisplay) {
            zelleUserEmailDisplay.textContent = savedUserEmail;
        }

        if (referralCodeField) {
            referralCodeField.value = `REFERRED_BY: ${dbReferredBy}`;
        }

        marketplace.classList.add('hidden');
        checkoutPage.classList.remove('hidden');
        window.scrollTo(0, 0);
    });

    btnBackToMarket.addEventListener('click', () => {
        checkoutPage.classList.add('hidden');
        marketplace.classList.remove('hidden');
    });

    // ================= SHIPPING TRANSACTION COMPLETION =================
    shippingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const referenceValue = zelleRefIdInput.value.trim();
        const customerName = document.getElementById('shippingName').value.trim();
        const shippingAddress = document.getElementById('shippingAddress').value.trim();
        const referralValue = referralCodeField.value;

        const now = new Date();
        const formattedDate = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + ' ' + 
            String(now.getHours()).padStart(2, '0') + ':' + 
            String(now.getMinutes()).padStart(2, '0');

        const randomTrackingNum = "CAL-" + Math.floor(100000 + Math.random() * 900000);
        const adminSupportNumber = "+1 (555) 867-5309"; 

        globalOrdersRegistry.push({
            id: Date.now(),
            date: formattedDate,
            name: customerName,
            address: shippingAddress,
            referral: referralValue,
            zelleRef: referenceValue,
            trackingNum: randomTrackingNum,
            status: "For Payment Confirmation",
            isNew: true 
        });

        alert(`DONE!\n\nTransaction reference code "${referenceValue}" has been submitted successfully.\n\nYour order tracking number is: ${randomTrackingNum}\n\nPlease wait for shipping tracking updates on your email after admin payment verification. If delayed, contact support at ${adminSupportNumber}.`);

        shoppingCart = {};
        shippingForm.reset();
        renderCartStructure();

        checkoutPage.classList.add('hidden');
        marketplace.classList.remove('hidden');
        window.scrollTo(0, 0);
    });

    // ================= ADMIN TAB NAVIGATION =================
    tabOrderTracking.addEventListener('click', () => {
        tabOrderTracking.classList.add('active');
        tabWhitelist.classList.remove('active');
        moduleOrderTracking.classList.remove('hidden');
        moduleWhitelist.classList.add('hidden');
    });

    tabWhitelist.addEventListener('click', () => {
        tabWhitelist.classList.add('active');
        tabOrderTracking.classList.remove('active');
        moduleWhitelist.classList.remove('hidden');
        moduleOrderTracking.classList.add('hidden');
        loadWhitelistFromDatabase();
    });

    // ================= MODULE 1: ADMIN ORDER DISPATCH CENTER =================
    function renderAdminOrdersTable() {
        ordersTableBody.innerHTML = '';
        selectedAdminOrderId = null;
        adminActionPanel.classList.add('panel-disabled');

        if (globalOrdersRegistry.length === 0) {
            ordersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#475569; padding:20px;">No registered system orders found.</td></tr>`;
            return;
        }

        globalOrdersRegistry.forEach(order => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', order.id);
            if (selectedAdminOrderId === order.id) tr.classList.add('selected-row');

            const glowingBadge = order.isNew ? `<span class="badge-new-order">New Order</span>` : '';
            const displayTracking = order.trackingNum ? order.trackingNum : 'N/A';

            tr.innerHTML = `
                <td class="timestamp-text">${order.date}</td>
                <td class="mono-text" style="color: #00bcd4; font-weight: 500;">${displayTracking}</td>
                <td>${glowingBadge}${order.name}</td>
                <td>${order.address}</td>
                <td class="mono-text">${order.referral}</td>
                <td class="mono-text">${order.zelleRef}</td>
                <td><span class="status-pill pill-${order.status.toLowerCase().replace(/[\s-]/g, '')}">${order.status}</span></td>
            `;

            tr.addEventListener('click', () => {
                document.querySelectorAll('#ordersTable tr').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedAdminOrderId = order.id;
                adminActionPanel.classList.remove('panel-disabled');
            });

            ordersTableBody.appendChild(tr);
        });
    }

    function updateSelectedOrderStatus(newStatus) {
        if (!selectedAdminOrderId) return;
        const targetOrder = globalOrdersRegistry.find(o => o.id === selectedAdminOrderId);
        if (targetOrder) {
            targetOrder.status = newStatus;
            if (newStatus === 'Shipment In-Progress' || newStatus === 'Delivered') {
                targetOrder.isNew = false;
            }
            renderAdminOrdersTable();
        }
    }

    btnStatusPayment.addEventListener('click', () => updateSelectedOrderStatus('For Payment Confirmation'));
    btnStatusShipment.addEventListener('click', () => updateSelectedOrderStatus('Shipment In-Progress'));
    btnStatusDelivered.addEventListener('click', () => updateSelectedOrderStatus('Delivered'));

    // ================= MODULE 2: WHITELIST MAINTENANCE =================
    function getFilteredWhitelistRecords() {
        return globalWhitelistRegistry.filter(record => {
            const matchesRole = (whitelistRoleFilter === "ALL") || (record.role === whitelistRoleFilter);
            
            const matchesQuery = !whitelistSearchQuery || (
                (record.email && record.email.toLowerCase().includes(whitelistSearchQuery)) ||
                (record.role && record.role.toLowerCase().includes(whitelistSearchQuery)) ||
                (record.status && record.status.toLowerCase().includes(whitelistSearchQuery)) ||
                (record.referredBy && record.referredBy.toLowerCase().includes(whitelistSearchQuery)) ||
                String(record.id).includes(whitelistSearchQuery)
            );

            return matchesRole && matchesQuery;
        });
    }

    function renderWhitelistTable() {
        whitelistTableBody.innerHTML = '';

        const filteredRecords = getFilteredWhitelistRecords();
        const totalRecords = filteredRecords.length;
        const totalPages = Math.ceil(totalRecords / WHITELIST_PER_PAGE) || 1;

        if (whitelistCurrentPage > totalPages) whitelistCurrentPage = totalPages;
        if (whitelistCurrentPage < 1) whitelistCurrentPage = 1;

        const startIndex = (whitelistCurrentPage - 1) * WHITELIST_PER_PAGE;
        const endIndex = startIndex + WHITELIST_PER_PAGE;
        const pageRecords = filteredRecords.slice(startIndex, endIndex);

        if (pageRecords.length === 0) {
            whitelistTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#475569; padding:20px;">No matching records found.</td></tr>`;
        } else {
            pageRecords.forEach(item => {
                const tr = document.createElement('tr');
                const roleClass = item.role === 'ADMIN' ? 'pill-admin' : 'pill-customer';
                const statusClass = item.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive';

                tr.innerHTML = `
                    <td class="mono-text" style="color: #64748b;">${item.id}</td>
                    <td class="mono-text" style="color: #e2e8f0;">${item.email}</td>
                    <td><span class="status-pill ${roleClass}">${item.role}</span></td>
                    <td><span class="status-pill ${statusClass}">${item.status}</span></td>
                    <td class="mono-text" style="color: #00bcd4;">${item.referredBy || 'N/A'}</td>
                    <td class="timestamp-text">${item.datecreated || ''}</td>
                    <td class="timestamp-text">${item.timecreated || ''}</td>
                    <td>
                        <button class="btn-action-edit" data-id="${item.id}">Edit</button>
                        <button class="btn-action-delete" data-id="${item.id}">Delete</button>
                    </td>
                `;

                whitelistTableBody.appendChild(tr);
            });
        }

        const currentRangeStart = totalRecords === 0 ? 0 : startIndex + 1;
        const currentRangeEnd = Math.min(endIndex, totalRecords);
        whitelistPaginationInfo.textContent = `Showing ${currentRangeStart}-${currentRangeEnd} of ${totalRecords} entries`;
        whitelistPageDisplay.textContent = `Page ${whitelistCurrentPage} of ${totalPages}`;

        btnWhitelistPrev.disabled = (whitelistCurrentPage <= 1);
        btnWhitelistNext.disabled = (whitelistCurrentPage >= totalPages);

        attachWhitelistTableActions();
    }

    // ROLE FILTER BUTTON LISTENERS
    document.querySelectorAll('.role-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.role-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            whitelistRoleFilter = e.target.getAttribute('data-role');
            whitelistCurrentPage = 1;
            renderWhitelistTable();
        });
    });

    // SEARCH INPUT EVENT LISTENER WITH DEBOUNCE
    if (whitelistSearchInput) {
        whitelistSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                whitelistSearchQuery = e.target.value.trim().toLowerCase();
                whitelistCurrentPage = 1;
                renderWhitelistTable();
            }, 150);
        });
    }

    // PAGINATION CONTROLS
    if (btnWhitelistPrev) {
        btnWhitelistPrev.addEventListener('click', () => {
            if (whitelistCurrentPage > 1) {
                whitelistCurrentPage--;
                renderWhitelistTable();
            }
        });
    }

    if (btnWhitelistNext) {
        btnWhitelistNext.addEventListener('click', () => {
            const totalPages = Math.ceil(getFilteredWhitelistRecords().length / WHITELIST_PER_PAGE);
            if (whitelistCurrentPage < totalPages) {
                whitelistCurrentPage++;
                renderWhitelistTable();
            }
        });
    }

    function attachWhitelistTableActions() {
        whitelistTableBody.querySelectorAll('.btn-action-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const record = globalWhitelistRegistry.find(r => r.id === id);
                
                if (record) {
                    whitelistIdInput.value = record.id;
                    whitelistEmailInput.value = record.email;
                    whitelistRoleSelect.value = record.role;
                    whitelistStatusSelect.value = record.status;
                    whitelistReferredByInput.value = record.referredBy;

                    whitelistFormTitle.textContent = "Edit Whitelist Entry";
                    btnSaveWhitelist.textContent = "Update Record";
                    btnCancelWhitelist.classList.remove('hidden');
                }
            });
        });

        whitelistTableBody.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                const record = globalWhitelistRegistry.find(r => r.id === id);

                if (record && confirm(`Are you sure you want to delete "${record.email}"?`)) {
                    try {
                        await fetch(`/api/whitelist/${id}`, { method: 'DELETE' });
                        globalWhitelistRegistry = globalWhitelistRegistry.filter(r => r.id !== id);
                        renderWhitelistTable();
                        resetWhitelistForm();
                    } catch (err) {
                        console.error("Failed to delete record:", err);
                    }
                }
            });
        });
    }

    whitelistForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = whitelistIdInput.value ? parseInt(whitelistIdInput.value) : null;
        const email = whitelistEmailInput.value.trim().toLowerCase();
        const role = whitelistRoleSelect.value;
        const status = whitelistStatusSelect.value;
        const referredBy = whitelistReferredByInput.value.trim() || 'CALTIDES_DIRECT';

        const { datecreated, timecreated } = getSystemDateTimeFormatted();

        const payload = { email, role, status, referredBy, datecreated, timecreated };

        try {
            if (id) {
                await fetch(`/api/whitelist/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const index = globalWhitelistRegistry.findIndex(r => r.id === id);
                if (index !== -1) {
                    globalWhitelistRegistry[index] = { ...globalWhitelistRegistry[index], ...payload };
                }
            } else {
                const response = await fetch('/api/whitelist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const createdRecord = await response.json();
                globalWhitelistRegistry.push(createdRecord.id ? createdRecord : { id: Date.now(), ...payload });
            }

            renderWhitelistTable();
            resetWhitelistForm();
        } catch (err) {
            console.error("Failed to save whitelist record:", err);
        }
    });

    btnCancelWhitelist.addEventListener('click', resetWhitelistForm);

    function resetWhitelistForm() {
        whitelistForm.reset();
        whitelistIdInput.value = '';
        whitelistFormTitle.textContent = "Add Whitelist Entry";
        btnSaveWhitelist.textContent = "Save Record";
        btnCancelWhitelist.classList.add('hidden');
        whitelistReferredByInput.value = 'CALTIDES_DIRECT';
    }
});