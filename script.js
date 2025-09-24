// Supabase configuration
const SUPABASE_URL = 'https://gmdjwwtlfjoiejsaqgdr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtZGp3d3RsZmpvaWVqc2FxZ2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTA0MTgsImV4cCI6MjA3NDI4NjQxOH0.LcCQYXohWd8w8RDJ0NhzJLjHf3kg64g8iFuDgL1YTjE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Supabase configuration

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM elements
const navItems = document.querySelectorAll('.nav-item');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const userInfo = document.getElementById('user-info');
const adminOnlyElements = document.querySelectorAll('.admin-only');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const pageTitle = document.getElementById('page-title');
const currentDateEl = document.getElementById('current-date');
const currentTimeEl = document.getElementById('current-time');

// Auth state
let currentUser = null;
let userRole = null;
let taxRate = 10; // Default tax rate
let lowStockThreshold = 10; // Default low stock threshold
let salesChart = null;
let productsChart = null;
let reportChart = null;

// Initialize app
async function init() {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    
    if (currentUser) {
        // Get user profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
            
        userRole = profile?.role || 'cashier';
        
        // Get settings
        const { data: settings } = await supabase
            .from('settings')
            .select('key, value');
            
        settings.forEach(setting => {
            if (setting.key === 'tax_rate') taxRate = parseFloat(setting.value);
            if (setting.key === 'low_stock_threshold') lowStockThreshold = parseInt(setting.value);
        });
        
        document.getElementById('tax-rate-display').textContent = `${taxRate}`;
    }
    
    updateAuthUI();
    updateDateTime();
    
    // Update time every second
    setInterval(updateDateTime, 1000);
    
    if (currentUser) {
        showSection('dashboard');
        loadDashboard();
    } else {
        showSection('login');
    }
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString();
    currentTimeEl.textContent = now.toLocaleTimeString();
}

// Authentication
loginBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
    });
    
    if (error) console.error('Error logging in:', error.message);
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentUser = null;
    userRole = null;
    updateAuthUI();
    showSection('login');
});

function updateAuthUI() {
    if (currentUser) {
        userName.textContent = currentUser.email;
        userRole.textContent = userRole;
        userInfo.classList.remove('hidden');
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        
        // Show/hide admin-only elements
        adminOnlyElements.forEach(el => {
            el.style.display = userRole === 'admin' ? 'flex' : 'none';
        });
    } else {
        userInfo.classList.add('hidden');
        loginBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
    }
}

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section === 'settings' && userRole !== 'admin') {
            alert('You do not have permission to access settings');
            return;
        }
        showSection(section);
        
        // Update active nav item
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Load section data
        switch(section) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'products':
                loadProducts();
                break;
            case 'sales':
                loadSales();
                break;
            case 'expenses':
                loadExpenses();
                break;
            case 'customers':
                loadCustomers();
                break;
            case 'reports':
                loadReports();
                break;
            case 'settings':
                if (userRole === 'admin') {
                    loadSettings();
                    loadUsers();
                    loadDiscounts();
                }
                break;
        }
    });
});

// Menu toggle for mobile
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    if (sectionName === 'login') {
        // Show login prompt
        document.querySelector('.main-content').innerHTML = `
            <section class="content-section">
                <div class="card">
                    <div class="card-content" style="text-align: center; padding: 50px;">
                        <i class="fas fa-lock" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;"></i>
                        <h2>Please Login</h2>
                        <p>You need to login to access the accounting system</p>
                        <button class="btn-primary" style="margin-top: 20px;" onclick="document.getElementById('login-btn').click()">
                            <i class="fas fa-sign-in-alt"></i>
                            Login with Google
                        </button>
                    </div>
                </div>
            </section>
        `;
    } else {
        document.getElementById(sectionName).classList.remove('hidden');
        pageTitle.textContent = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
    }
}

// Dashboard Functions
async function loadDashboard() {
    // Load inventory alerts
    const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock, low_stock_threshold');
    
    const alertsList = document.getElementById('alerts-list');
    const alertCount = document.getElementById('alert-count');
    
    const alerts = lowStockProducts.filter(p => p.stock < p.low_stock_threshold);
    
    if (alerts.length > 0) {
        alertCount.textContent = alerts.length;
        alertsList.innerHTML = alerts.map(product => `
            <div class="alert-item">
                <span class="alert-name">${product.name}</span>
                <span class="alert-stock">Only ${product.stock} left</span>
            </div>
        `).join('');
    } else {
        alertCount.textContent = '0';
        alertsList.innerHTML = '<div class="alert-item">No inventory alerts</div>';
    }
    
    // Load sales data
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total, tax_amount');
    
    // Load expenses data
    const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount');
    
    if (salesError || expensesError) {
        console.error('Error loading dashboard:', salesError || expensesError);
        return;
    }
    
    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const totalTax = sales.reduce((sum, sale) => sum + parseFloat(sale.tax_amount || 0), 0);
    const netProfit = totalSales - totalExpenses;
    
    document.getElementById('total-sales').textContent = `$${totalSales.toFixed(2)}`;
    document.getElementById('total-expenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('net-profit').textContent = `$${netProfit.toFixed(2)}`;
    document.getElementById('tax-collected').textContent = `$${totalTax.toFixed(2)}`;
    
    // Load recent activity
    loadRecentActivity();
    
    // Load charts
    loadSalesChart();
    loadProductsChart();
}

async function loadRecentActivity() {
    // Get recent sales
    const { data: recentSales } = await supabase
        .from('sales')
        .select(`
            sale_date,
            total,
            products(name)
        `)
        .order('sale_date', { ascending: false })
        .limit(3);
    
    // Get recent expenses
    const { data: recentExpenses } = await supabase
        .from('expenses')
        .select('expense_date, amount, description')
        .order('expense_date', { ascending: false })
        .limit(2);
    
    // Get recent products
    const { data: recentProducts } = await supabase
        .from('products')
        .select('created_at, name')
        .order('created_at', { ascending: false })
        .limit(1);
    
    // Combine and sort all activities
    const activities = [
        ...recentSales.map(sale => ({
            type: 'sale',
            title: `Sale: ${sale.products.name}`,
            time: new Date(sale.sale_date),
            amount: sale.total
        })),
        ...recentExpenses.map(expense => ({
            type: 'expense',
            title: `Expense: ${expense.description}`,
            time: new Date(expense.expense_date),
            amount: expense.amount
        })),
        ...recentProducts.map(product => ({
            type: 'product',
            title: `New Product: ${product.name}`,
            time: new Date(product.created_at)
        }))
    ];
    
    // Sort by time (most recent first)
    activities.sort((a, b) => b.time - a.time);
    
    // Display activities
    const activityList = document.getElementById('recent-activity');
    activityList.innerHTML = activities.map(activity => {
        const timeAgo = getTimeAgo(activity.time);
        const iconClass = activity.type === 'sale' ? 'fa-shopping-cart' : 
                         activity.type === 'expense' ? 'fa-receipt' : 'fa-box';
        const amountText = activity.amount ? `$${activity.amount.toFixed(2)}` : '';
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">${activity.title} ${amountText}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    
    return "Just now";
}

async function loadSalesChart() {
    const { data: salesData } = await supabase
        .from('sales')
        .select('sale_date, total')
        .order('sale_date');
    
    // Group sales by date
    const salesByDate = {};
    salesData.forEach(sale => {
        const date = new Date(sale.sale_date).toLocaleDateString();
        if (!salesByDate[date]) {
            salesByDate[date] = 0;
        }
        salesByDate[date] += parseFloat(sale.total);
    });
    
    const labels = Object.keys(salesByDate);
    const data = Object.values(salesByDate);
    
    const ctx = document.getElementById('sales-chart').getContext('2d');
    
    if (salesChart) {
        salesChart.destroy();
    }
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Sales',
                data: data,
                backgroundColor: 'rgba(67, 97, 238, 0.2)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 2,
                tension: 0.3,
                pointBackgroundColor: 'rgba(67, 97, 238, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(67, 97, 238, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1,
                    cornerRadius: 4,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Sales: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

async function loadProductsChart() {
    const { data: salesData } = await supabase
        .from('sales')
        .select(`
            quantity,
            products(name)
        `);
    
    // Group sales by product
    const salesByProduct = {};
    salesData.forEach(sale => {
        if (!salesByProduct[sale.products.name]) {
            salesByProduct[sale.products.name] = 0;
        }
        salesByProduct[sale.products.name] += sale.quantity;
    });
    
    // Sort by quantity sold (top 5)
    const sortedProducts = Object.entries(salesByProduct)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const labels = sortedProducts.map(p => p[0]);
    const data = sortedProducts.map(p => p[1]);
    
    const ctx = document.getElementById('products-chart').getContext('2d');
    
    if (productsChart) {
        productsChart.destroy();
    }
    
    productsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Units Sold',
                data: data,
                backgroundColor: [
                    'rgba(67, 97, 238, 0.8)',
                    'rgba(76, 201, 240, 0.8)',
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(40, 167, 69, 0.8)',
                    'rgba(220, 53, 69, 0.8)'
                ],
                borderColor: [
                    'rgba(67, 97, 238, 1)',
                    'rgba(76, 201, 240, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(40, 167, 69, 1)',
                    'rgba(220, 53, 69, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1,
                    cornerRadius: 4,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Units: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Products Functions
async function loadProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*');
    
    if (error) {
        console.error('Error loading products:', error.message);
        return;
    }
    
    const productsTableBody = document.getElementById('products-table-body');
    productsTableBody.innerHTML = data.map(product => {
        const stockStatus = product.stock < product.low_stock_threshold 
            ? '<span class="status-badge low-stock">Low Stock</span>' 
            : '<span class="status-badge in-stock">In Stock</span>';
        
        return `
            <tr>
                <td>${product.name}</td>
                <td>$${parseFloat(product.price).toFixed(2)}</td>
                <td>${product.stock}</td>
                <td>${product.low_stock_threshold}</td>
                <td>${stockStatus}</td>
                <td>
                    <button class="btn-icon" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Product Modal
const productModal = document.getElementById('product-modal');
const addProductBtn = document.getElementById('add-product-btn');
const closeProductModal = productModal.querySelector('.close');
const productForm = document.getElementById('product-form');

addProductBtn.addEventListener('click', () => {
    productModal.style.display = 'block';
});

closeProductModal.addEventListener('click', () => {
    productModal.style.display = 'none';
});

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const stock = document.getElementById('product-stock').value;
    const threshold = document.getElementById('product-threshold').value;
    
    const { error } = await supabase
        .from('products')
        .insert([{ name, price, stock, low_stock_threshold: threshold }]);
    
    if (error) {
        console.error('Error adding product:', error.message);
        return;
    }
    
    productModal.style.display = 'none';
    productForm.reset();
    loadProducts();
});

// Sales Functions
async function loadSales() {
    const { data, error } = await supabase
        .from('sales')
        .select(`
            id,
            quantity,
            total,
            sale_date,
            products(name),
            customers(name)
        `)
        .order('sale_date', { ascending: false });
    
    if (error) {
        console.error('Error loading sales:', error.message);
        return;
    }
    
    const salesTableBody = document.getElementById('sales-table-body');
    salesTableBody.innerHTML = data.map(sale => `
        <tr>
            <td>#${sale.id}</td>
            <td>${sale.products.name}</td>
            <td>${sale.customers.name}</td>
            <td>${sale.quantity}</td>
            <td>$${parseFloat(sale.total).toFixed(2)}</td>
            <td>${new Date(sale.sale_date).toLocaleDateString()}</td>
            <td>
                <button class="btn-icon print-sale-btn" data-id="${sale.id}" title="Print Receipt">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to print buttons
    document.querySelectorAll('.print-sale-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const saleId = this.dataset.id;
            printReceipt(saleId);
        });
    });
}

// Sale Modal
const saleModal = document.getElementById('sale-modal');
const newSaleBtn = document.getElementById('new-sale-btn');
const closeSaleModal = saleModal.querySelector('.close');
const saleForm = document.getElementById('sale-form');

newSaleBtn.addEventListener('click', async () => {
    // Load products and customers for the sale form
    await loadProductsForSale();
    await loadCustomersForSale();
    await loadDiscountsForSale();
    saleModal.style.display = 'block';
});

closeSaleModal.addEventListener('click', () => {
    saleModal.style.display = 'none';
});

async function loadProductsForSale() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, stock');
    
    if (error) {
        console.error('Error loading products for sale:', error.message);
        return;
    }
    
    const select = document.getElementById('sale-product');
    select.innerHTML = '<option value="">Select Product</option>';
    
    data.forEach(product => {
        if (product.stock > 0) {
            select.innerHTML += `<option value="${product.id}">${product.name} (Stock: ${product.stock})</option>`;
        }
    });
    
    // Add event listener to calculate total when product or quantity changes
    select.addEventListener('change', calculateSaleTotal);
    document.getElementById('sale-quantity').addEventListener('input', calculateSaleTotal);
    document.getElementById('sale-discount').addEventListener('change', calculateSaleTotal);
}

async function loadCustomersForSale() {
    const { data, error } = await supabase
        .from('customers')
        .select('id, name');
    
    if (error) {
        console.error('Error loading customers for sale:', error.message);
        return;
    }
    
    const select = document.getElementById('sale-customer');
    select.innerHTML = '<option value="">Select Customer</option>';
    
    data.forEach(customer => {
        select.innerHTML += `<option value="${customer.id}">${customer.name}</option>`;
    });
}

async function loadDiscountsForSale() {
    const { data, error } = await supabase
        .from('discounts')
        .select('id, name, type, value');
    
    if (error) {
        console.error('Error loading discounts for sale:', error.message);
        return;
    }
    
    const select = document.getElementById('sale-discount');
    select.innerHTML = '<option value="">No Discount</option>';
    
    data.forEach(discount => {
        const displayText = discount.type === 'percentage' 
            ? `${discount.name} (${discount.value}%)`
            : `${discount.name} ($${discount.value})`;
        select.innerHTML += `<option value="${discount.id}">${displayText}</option>`;
    });
}

async function calculateSaleTotal() {
    const productId = document.getElementById('sale-product').value;
    const quantity = parseInt(document.getElementById('sale-quantity').value) || 0;
    const discountId = document.getElementById('sale-discount').value;
    
    if (!productId || !quantity) {
        document.getElementById('subtotal').textContent = '$0.00';
        document.getElementById('discount-amount').textContent = '$0.00';
        document.getElementById('tax-amount').textContent = '$0.00';
        document.getElementById('total-amount').textContent = '$0.00';
        return;
    }
    
    // Get product price
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('price')
        .eq('id', productId)
        .single();
    
    if (productError) {
        console.error('Error fetching product:', productError.message);
        return;
    }
    
    const price = parseFloat(product.price);
    const subtotal = price * quantity;
    
    // Calculate discount
    let discountAmount = 0;
    if (discountId) {
        const { data: discount, error: discountError } = await supabase
            .from('discounts')
            .select('type, value')
            .eq('id', discountId)
            .single();
        
        if (discountError) {
            console.error('Error fetching discount:', discountError.message);
        } else if (discount) {
            if (discount.type === 'percentage') {
                discountAmount = subtotal * (parseFloat(discount.value) / 100);
            } else {
                discountAmount = parseFloat(discount.value);
            }
        }
    }
    
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;
    
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('discount-amount').textContent = `$${discountAmount.toFixed(2)}`;
    document.getElementById('tax-amount').textContent = `$${taxAmount.toFixed(2)}`;
    document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;
}

saleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productId = document.getElementById('sale-product').value;
    const customerId = document.getElementById('sale-customer').value;
    const quantity = parseInt(document.getElementById('sale-quantity').value);
    const discountId = document.getElementById('sale-discount').value;
    
    // Get product details
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('price, stock')
        .eq('id', productId)
        .single();
    
    if (productError || !product) {
        console.error('Error fetching product:', productError?.message || 'Product not found');
        return;
    }
    
    if (product.stock < quantity) {
        alert('Not enough stock available');
        return;
    }
    
    const price = parseFloat(product.price);
    const subtotal = price * quantity;
    
    // Calculate discount
    let discountAmount = 0;
    if (discountId) {
        const { data: discount } = await supabase
            .from('discounts')
            .select('type, value')
            .eq('id', discountId)
            .single();
        
        if (discount) {
            if (discount.type === 'percentage') {
                discountAmount = subtotal * (parseFloat(discount.value) / 100);
            } else {
                discountAmount = parseFloat(discount.value);
            }
        }
    }
    
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;
    
    // Record sale
    const { error: saleError } = await supabase
        .from('sales')
        .insert([{ 
            product_id: productId, 
            customer_id: customerId,
            quantity, 
            total,
            tax_amount: taxAmount,
            tax_rate: taxRate
        }]);
    
    if (saleError) {
        console.error('Error recording sale:', saleError.message);
        return;
    }
    
    // Update product stock
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: product.stock - quantity })
        .eq('id', productId);
    
    if (updateError) {
        console.error('Error updating stock:', updateError.message);
        return;
    }
    
    saleModal.style.display = 'none';
    saleForm.reset();
    loadSales();
    
    // Show receipt
    const { data: newSale } = await supabase
        .from('sales')
        .select(`
            id,
            quantity,
            total,
            tax_amount,
            sale_date,
            products(name, price),
            customers(name, email, phone)
        `)
        .eq('product_id', productId)
        .eq('customer_id', customerId)
        .eq('quantity', quantity)
        .order('sale_date', { ascending: false })
        .limit(1)
        .single();
    
    if (newSale) {
        showReceipt(newSale);
    }
});

// Expenses Functions
async function loadExpenses() {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });
    
    if (error) {
        console.error('Error loading expenses:', error.message);
        return;
    }
    
    const expensesTableBody = document.getElementById('expenses-table-body');
    expensesTableBody.innerHTML = data.map(expense => `
        <tr>
            <td>${expense.description}</td>
            <td>$${parseFloat(expense.amount).toFixed(2)}</td>
            <td>${expense.category}</td>
            <td>${new Date(expense.expense_date).toLocaleDateString()}</td>
            <td>
                <button class="btn-icon" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Expense Modal
const expenseModal = document.getElementById('expense-modal');
const addExpenseBtn = document.getElementById('add-expense-btn');
const closeExpenseModal = expenseModal.querySelector('.close');
const expenseForm = document.getElementById('expense-form');

addExpenseBtn.addEventListener('click', () => {
    expenseModal.style.display = 'block';
});

closeExpenseModal.addEventListener('click', () => {
    expenseModal.style.display = 'none';
});

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('expense-desc').value;
    const amount = document.getElementById('expense-amount').value;
    const category = document.getElementById('expense-category').value;
    
    const { error } = await supabase
        .from('expenses')
        .insert([{ description, amount, category }]);
    
    if (error) {
        console.error('Error adding expense:', error.message);
        return;
    }
    
    expenseModal.style.display = 'none';
    expenseForm.reset();
    loadExpenses();
});

// Customers Functions
async function loadCustomers() {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error loading customers:', error.message);
        return;
    }
    
    // Calculate total purchases for each customer
    const customerIds = data.map(c => c.id);
    const { data: salesData } = await supabase
        .from('sales')
        .select('customer_id, total')
        .in('customer_id', customerIds);
    
    const purchasesByCustomer = {};
    salesData.forEach(sale => {
        if (!purchasesByCustomer[sale.customer_id]) {
            purchasesByCustomer[sale.customer_id] = 0;
        }
        purchasesByCustomer[sale.customer_id] += parseFloat(sale.total);
    });
    
    const customersTableBody = document.getElementById('customers-table-body');
    customersTableBody.innerHTML = data.map(customer => `
        <tr>
            <td>${customer.name}</td>
            <td>${customer.email || '-'}</td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.address || '-'}</td>
            <td>$${(purchasesByCustomer[customer.id] || 0).toFixed(2)}</td>
            <td>
                <button class="btn-icon" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Customer Modal
const customerModal = document.getElementById('customer-modal');
const addCustomerBtn = document.getElementById('add-customer-btn');
const closeCustomerModal = customerModal.querySelector('.close');
const customerForm = document.getElementById('customer-form');

addCustomerBtn.addEventListener('click', () => {
    customerModal.style.display = 'block';
});

closeCustomerModal.addEventListener('click', () => {
    customerModal.style.display = 'none';
});

customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const phone = document.getElementById('customer-phone').value;
    const address = document.getElementById('customer-address').value;
    
    const { error } = await supabase
        .from('customers')
        .insert([{ name, email, phone, address }]);
    
    if (error) {
        console.error('Error adding customer:', error.message);
        return;
    }
    
    customerModal.style.display = 'none';
    customerForm.reset();
    loadCustomers();
});

// Reports Functions
async function loadReports() {
    // Load quick stats
    const { data: products } = await supabase
        .from('products')
        .select('id, stock, low_stock_threshold');
    
    const { data: customers } = await supabase
        .from('customers')
        .select('id');
    
    const { data: sales } = await supabase
        .from('sales')
        .select('total');
    
    const totalProducts = products.length;
    const lowStockItems = products.filter(p => p.stock < p.low_stock_threshold).length;
    const totalCustomers = customers.length;
    const avgSale = sales.length > 0 
        ? sales.reduce((sum, sale) => sum + parseFloat(sale.total), 0) / sales.length 
        : 0;
    
    document.getElementById('quick-total-products').textContent = totalProducts;
    document.getElementById('quick-low-stock').textContent = lowStockItems;
    document.getElementById('quick-total-customers').textContent = totalCustomers;
    document.getElementById('quick-avg-sale').textContent = `$${avgSale.toFixed(2)}`;
    
    // Initialize report chart
    initReportChart();
}

function initReportChart() {
    const ctx = document.getElementById('report-chart').getContext('2d');
    
    if (reportChart) {
        reportChart.destroy();
    }
    
    reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Report Data',
                data: [],
                backgroundColor: 'rgba(67, 97, 238, 0.6)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1,
                    cornerRadius: 4,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Amount: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

document.getElementById('generate-report').addEventListener('click', async () => {
    const reportType = document.getElementById('report-type').value;
    const startDate = document.getElementById('report-start').value;
    const endDate = document.getElementById('report-end').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    let data, labels, title;
    
    switch(reportType) {
        case 'sales':
            const { data: sales } = await supabase
                .from('sales')
                .select('sale_date, total')
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);
            
            // Group sales by date
            const salesByDate = {};
            sales.forEach(sale => {
                const date = new Date(sale.sale_date).toLocaleDateString();
                if (!salesByDate[date]) {
                    salesByDate[date] = 0;
                }
                salesByDate[date] += parseFloat(sale.total);
            });
            
            labels = Object.keys(salesByDate);
            data = Object.values(salesByDate);
            title = 'Sales Report';
            break;
            
        case 'expenses':
            const { data: expenses } = await supabase
                .from('expenses')
                .select('expense_date, amount, category')
                .gte('expense_date', startDate)
                .lte('expense_date', endDate);
            
            // Group expenses by category
            const expensesByCategory = {};
            expenses.forEach(expense => {
                if (!expensesByCategory[expense.category]) {
                    expensesByCategory[expense.category] = 0;
                }
                expensesByCategory[expense.category] += parseFloat(expense.amount);
            });
            
            labels = Object.keys(expensesByCategory);
            data = Object.values(expensesByCategory);
            title = 'Expenses by Category';
            break;
            
        case 'profit-loss':
            const { data: plSales } = await supabase
                .from('sales')
                .select('sale_date, total')
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);
                
            const { data: plExpenses } = await supabase
                .from('expenses')
                .select('expense_date, amount')
                .gte('expense_date', startDate)
                .lte('expense_date', endDate);
            
            // Calculate total sales and expenses
            const totalSales = plSales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
            const totalExpenses = plExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
            const netProfit = totalSales - totalExpenses;
            
            labels = ['Sales', 'Expenses', 'Net Profit'];
            data = [totalSales, totalExpenses, netProfit];
            title = 'Profit & Loss Report';
            break;
            
        case 'inventory':
            const { data: inventoryProducts } = await supabase
                .from('products')
                .select('name, stock, price');
            
            labels = inventoryProducts.map(p => p.name);
            data = inventoryProducts.map(p => p.stock * parseFloat(p.price));
            title = 'Inventory Value';
            break;
            
        case 'customers':
            const { data: customerSales } = await supabase
                .from('sales')
                .select(`
                    customers(name),
                    total
                `)
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);
            
            // Group sales by customer
            const salesByCustomer = {};
            customerSales.forEach(sale => {
                if (!salesByCustomer[sale.customers.name]) {
                    salesByCustomer[sale.customers.name] = 0;
                }
                salesByCustomer[sale.customers.name] += parseFloat(sale.total);
            });
            
            labels = Object.keys(salesByCustomer);
            data = Object.values(salesByCustomer);
            title = 'Customer Purchases';
            break;
            
        case 'tax':
            const { data: taxSales } = await supabase
                .from('sales')
                .select('sale_date, tax_amount')
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);
            
            // Group tax by date
            const taxByDate = {};
            taxSales.forEach(sale => {
                const date = new Date(sale.sale_date).toLocaleDateString();
                if (!taxByDate[date]) {
                    taxByDate[date] = 0;
                }
                taxByDate[date] += parseFloat(sale.tax_amount || 0);
            });
            
            labels = Object.keys(taxByDate);
            data = Object.values(taxByDate);
            title = 'Tax Collected';
            break;
    }
    
    // Update chart
    reportChart.data.labels = labels;
    reportChart.data.datasets[0].data = data;
    reportChart.data.datasets[0].label = title;
    reportChart.update();
    
    // Update title
    document.getElementById('report-title').textContent = title;
    
    // Generate report table
    generateReportTable(reportType, labels, data);
});

function generateReportTable(reportType, labels, data) {
    const reportTable = document.getElementById('report-table');
    
    let tableHTML = `<table class="data-table">`;
    
    if (reportType === 'profit-loss') {
        tableHTML += `
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Total Sales</td>
                    <td>$${data[0].toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Total Expenses</td>
                    <td>$${data[1].toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Net Profit</td>
                    <td>$${data[2].toFixed(2)}</td>
                </tr>
            </tbody>
        `;
    } else {
        const headerText = reportType === 'sales' || reportType === 'tax' 
            ? 'Date' 
            : reportType === 'expenses' 
                ? 'Category' 
                : reportType === 'inventory' 
                    ? 'Product' 
                    : 'Customer';
        
        tableHTML += `
            <thead>
                <tr>
                    <th>${headerText}</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${labels.map((label, index) => `
                    <tr>
                        <td>${label}</td>
                        <td>$${data[index].toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    }
    
    tableHTML += '</table>';
    reportTable.innerHTML = tableHTML;
}

// Settings Functions
async function loadSettings() {
    document.getElementById('tax-rate').value = taxRate;
    document.getElementById('stock-threshold').value = lowStockThreshold;
}

document.getElementById('tax-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newTaxRate = parseFloat(document.getElementById('tax-rate').value);
    
    const { error } = await supabase
        .from('settings')
        .update({ value: newTaxRate.toString() })
        .eq('key', 'tax_rate');
    
    if (error) {
        console.error('Error updating tax rate:', error.message);
        return;
    }
    
    taxRate = newTaxRate;
    document.getElementById('tax-rate-display').textContent = `${taxRate}`;
    alert('Tax rate updated successfully');
});

document.getElementById('inventory-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newThreshold = parseInt(document.getElementById('stock-threshold').value);
    
    const { error } = await supabase
        .from('settings')
        .update({ value: newThreshold.toString() })
        .eq('key', 'low_stock_threshold');
    
    if (error) {
        console.error('Error updating stock threshold:', error.message);
        return;
    }
    
    lowStockThreshold = newThreshold;
    alert('Low stock threshold updated successfully');
});

async function loadUsers() {
    const { data: users, error } = await supabase
        .from('user_profiles')
        .select(`
            id,
            role,
            users(email)
        `);
    
    if (error) {
        console.error('Error loading users:', error.message);
        return;
    }
    
    const userList = document.getElementById('user-list');
    userList.innerHTML = users.map(user => `
        <div class="user-list-item">
            <span>${user.users.email}</span>
            <span class="status-badge">${user.role}</span>
        </div>
    `).join('');
    
    const userSelect = document.getElementById('user-select');
    userSelect.innerHTML = '<option value="">Select User</option>';
    
    users.forEach(user => {
        userSelect.innerHTML += `<option value="${user.id}">${user.users.email}</option>`;
    });
}

document.getElementById('user-role-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('user-select').value;
    const newRole = document.getElementById('role-select').value;
    
    const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);
    
    if (error) {
        console.error('Error updating user role:', error.message);
        return;
    }
    
    loadUsers();
    alert('User role updated successfully');
});

// Discount Management Functions
async function loadDiscounts() {
    const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error loading discounts:', error.message);
        return;
    }
    
    const discountsList = document.getElementById('discounts-list');
    discountsList.innerHTML = data.map(discount => `
        <div class="discount-item">
            <span>${discount.name}</span>
            <span class="discount-value">
                ${discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`}
            </span>
        </div>
    `).join('');
}

document.getElementById('discount-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('discount-name').value;
    const type = document.getElementById('discount-type').value;
    const value = document.getElementById('discount-value').value;
    
    const { error } = await supabase
        .from('discounts')
        .insert([{ name, type, value }]);
    
    if (error) {
        console.error('Error adding discount:', error.message);
        return;
    }
    
    e.target.reset();
    loadDiscounts();
});

// Receipt Functions
function showReceipt(sale) {
    const modal = document.getElementById('receipt-modal');
    const receiptContent = document.getElementById('receipt-content');
    
    receiptContent.innerHTML = `
        <div class="receipt-header">
            <h2>Store Receipt</h2>
            <p>Date: ${new Date(sale.sale_date).toLocaleString()}</p>
        </div>
        <div class="receipt-details">
            <div class="receipt-row">
                <span>Product:</span>
                <span>${sale.products.name}</span>
            </div>
            <div class="receipt-row">
                <span>Price:</span>
                <span>$${parseFloat(sale.products.price).toFixed(2)}</span>
            </div>
            <div class="receipt-row">
                <span>Quantity:</span>
                <span>${sale.quantity}</span>
            </div>
            <div class="receipt-row">
                <span>Subtotal:</span>
                <span>$${(parseFloat(sale.total) - parseFloat(sale.tax_amount)).toFixed(2)}</span>
            </div>
            <div class="receipt-row">
                <span>Tax (${taxRate}%):</span>
                <span>$${parseFloat(sale.tax_amount).toFixed(2)}</span>
            </div>
            <div class="receipt-row receipt-total">
                <span>Total:</span>
                <span>$${parseFloat(sale.total).toFixed(2)}</span>
            </div>
        </div>
        <div class="receipt-customer">
            <h3>Customer Information</h3>
            <p>Name: ${sale.customers.name}</p>
            ${sale.customers.email ? `<p>Email: ${sale.customers.email}</p>` : ''}
            ${sale.customers.phone ? `<p>Phone: ${sale.customers.phone}</p>` : ''}
        </div>
    `;
    
    modal.style.display = 'block';
}

function printReceipt(saleId) {
    supabase
        .from('sales')
        .select(`
            id,
            quantity,
            total,
            tax_amount,
            sale_date,
            products(name, price),
            customers(name, email, phone)
        `)
        .eq('id', saleId)
        .single()
        .then(({ data, error }) => {
            if (error) {
                console.error('Error fetching sale for receipt:', error.message);
                return;
            }
            
            showReceipt(data);
        });
}

document.getElementById('print-receipt').addEventListener('click', () => {
    window.print();
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
