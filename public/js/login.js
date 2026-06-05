const i18n = {
    vi: {
        loginTitle: "Đăng nhập NAS Server",
        loginDesc: "Vui lòng nhập tài khoản để truy cập tệp tin",
        usernameLabel: "Tên đăng nhập",
        passwordLabel: "Mật khẩu",
        loginBtn: "Đăng nhập",
        errorEmpty: "Vui lòng nhập đầy đủ tài khoản và mật khẩu.",
        errorFailed: "Tên đăng nhập hoặc mật khẩu không chính xác.",
        errorNetwork: "Lỗi kết nối tới máy chủ.",
        forgotPasswordLink: "Quên mật khẩu?",
        emailLabel: "Địa chỉ Email liên kết",
        sendResetBtn: "Gửi yêu cầu",
        backToLogin: "Quay lại Đăng nhập",
        forgotDesc: "Nhập email liên kết với tài khoản để khôi phục mật khẩu",
        emailSentSuccess: "Yêu cầu khôi phục đã được gửi. Kiểm tra hòm thư của bạn.",
        errorEmailEmpty: "Vui lòng nhập địa chỉ email.",
        errorEmailFailed: "Gửi email khôi phục thất bại.",
        otpTitle: "Xác thực hai lớp (2FA)",
        otpDesc: "Nhập mã OTP 6 chữ số đã được gửi qua Telegram của bạn",
        otpLabel: "Mã xác thực OTP",
        otpBtn: "Xác minh",
        errorOtpInvalid: "Mã OTP không chính xác hoặc đã hết hạn.",
        errorOtpEmpty: "Vui lòng nhập mã OTP."
    },
    en: {
        loginTitle: "NAS Server Login",
        loginDesc: "Enter your credentials to browse files",
        usernameLabel: "Username",
        passwordLabel: "Password",
        loginBtn: "Log In",
        errorEmpty: "Username and password are required.",
        errorFailed: "Invalid username or password.",
        errorNetwork: "Connection error to the server.",
        forgotPasswordLink: "Forgot password?",
        emailLabel: "Linked Email Address",
        sendResetBtn: "Send Reset Request",
        backToLogin: "Back to Login",
        forgotDesc: "Enter the email associated with your account to reset your password",
        emailSentSuccess: "Reset request sent. Please check your inbox.",
        errorEmailEmpty: "Please enter your email address.",
        errorEmailFailed: "Failed to send reset email.",
        otpTitle: "Two-Factor Auth (2FA)",
        otpDesc: "Enter the 6-digit OTP code sent to your Telegram",
        otpLabel: "OTP Verification Code",
        otpBtn: "Verify Code",
        errorOtpInvalid: "Invalid or expired OTP code.",
        errorOtpEmpty: "Please enter the OTP code."
    }
};

let currentLang = localStorage.getItem('nas_lang') || 'vi';

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    document.addEventListener('click', () => {
        document.getElementById('langDropdown').classList.remove('show');
    });
});

function toggleLangMenu(e) {
    e.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('show');
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('nas_lang', lang);
    applyLanguage();
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang] && i18n[currentLang][key]) {
            el.textContent = i18n[currentLang][key];
        }
    });

    // Update description based on visibility
    const desc = document.querySelector('.logo-section p');
    const logoTitle = document.querySelector('.logo-section h1');
    if (document.getElementById('forgotForm') && document.getElementById('forgotForm').style.display === 'block') {
        desc.textContent = i18n[currentLang].forgotDesc;
        logoTitle.textContent = i18n[currentLang].loginTitle; // Keep title same or forgotTitle
    } else if (document.getElementById('otpForm') && document.getElementById('otpForm').style.display === 'block') {
        desc.textContent = i18n[currentLang].otpDesc;
        logoTitle.textContent = i18n[currentLang].otpTitle;
    } else {
        desc.textContent = i18n[currentLang].loginDesc;
        logoTitle.textContent = i18n[currentLang].loginTitle;
    }

    // Update language switcher UI
    const flag = currentLang === 'vi' ? '🇻🇳' : '🇬🇧';
    document.getElementById('currentLangIcon').textContent = flag;
    document.getElementById('currentLangText').textContent = currentLang.toUpperCase();
    document.title = i18n[currentLang].loginTitle;
}

async function handleLogin(e) {
    e.preventDefault();
    const errorAlert = document.getElementById('errorAlert');
    const errorText = document.getElementById('errorText');
    errorAlert.classList.remove('show');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        errorText.textContent = i18n[currentLang].errorEmpty;
        errorAlert.classList.add('show');
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.otpRequired) {
                showOTPForm();
            } else {
                window.location.href = '/';
            }
        } else {
            const err = await res.json().catch(() => ({}));
            errorText.textContent = err.error ? (currentLang === 'vi' ? 'Tên đăng nhập hoặc mật khẩu không chính xác.' : 'Invalid username or password.') : i18n[currentLang].errorFailed;
            errorAlert.classList.add('show');
        }
    } catch (err) {
        errorText.textContent = i18n[currentLang].errorNetwork;
        errorAlert.classList.add('show');
    }
}

function showForgotPassword(e) {
    e.preventDefault();
    document.getElementById('errorAlert').classList.remove('show');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'block';
    
    // update subtitle description
    const desc = document.querySelector('.logo-section p');
    desc.textContent = i18n[currentLang].forgotDesc;
}

function showLoginForm(e) {
    if (e) e.preventDefault();
    document.getElementById('errorAlert').classList.remove('show');
    if (document.getElementById('forgotForm')) document.getElementById('forgotForm').style.display = 'none';
    if (document.getElementById('otpForm')) document.getElementById('otpForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    
    // restore subtitle description
    const desc = document.querySelector('.logo-section p');
    const logoTitle = document.querySelector('.logo-section h1');
    desc.textContent = i18n[currentLang].loginDesc;
    logoTitle.textContent = i18n[currentLang].loginTitle;
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const errorAlert = document.getElementById('errorAlert');
    const errorText = document.getElementById('errorText');
    errorAlert.classList.remove('show');

    const email = document.getElementById('email').value.trim();

    if (!email) {
        errorText.textContent = i18n[currentLang].errorEmailEmpty;
        errorAlert.classList.add('show');
        return;
    }

    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (res.ok) {
            // Show success state
            alert(i18n[currentLang].emailSentSuccess);
            showLoginForm(e);
        } else {
            const err = await res.json().catch(() => ({}));
            errorText.textContent = err.error || i18n[currentLang].errorEmailFailed;
            errorAlert.classList.add('show');
        }
    } catch (err) {
        errorText.textContent = i18n[currentLang].errorNetwork;
        errorAlert.classList.add('show');
    }
}

function showOTPForm() {
    document.getElementById('errorAlert').classList.remove('show');
    document.getElementById('loginForm').style.display = 'none';
    if (document.getElementById('forgotForm')) document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('otpForm').style.display = 'block';

    // update title & subtitle description
    const desc = document.querySelector('.logo-section p');
    const logoTitle = document.querySelector('.logo-section h1');
    desc.textContent = i18n[currentLang].otpDesc;
    logoTitle.textContent = i18n[currentLang].otpTitle;
}

async function handleOTP(e) {
    e.preventDefault();
    const errorAlert = document.getElementById('errorAlert');
    const errorText = document.getElementById('errorText');
    errorAlert.classList.remove('show');

    const otp = document.getElementById('otp').value.trim();

    if (!otp) {
        errorText.textContent = i18n[currentLang].errorOtpEmpty;
        errorAlert.classList.add('show');
        return;
    }

    try {
        const res = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp })
        });

        if (res.ok) {
            window.location.href = '/';
        } else {
            const err = await res.json().catch(() => ({}));
            errorText.textContent = err.error || i18n[currentLang].errorOtpInvalid;
            errorAlert.classList.add('show');
        }
    } catch (err) {
        errorText.textContent = i18n[currentLang].errorNetwork;
        errorAlert.classList.add('show');
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('.material-icons-round');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
}
