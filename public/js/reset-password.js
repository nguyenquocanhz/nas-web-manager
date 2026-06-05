const i18n = {
    vi: {
        resetTitle: "Khôi phục Mật khẩu",
        resetDesc: "Đặt mật khẩu mới để tiếp tục sử dụng hệ thống",
        validating: "Đang xác thực mã khôi phục...",
        userLabel: "Tài khoản",
        newPassLabel: "Mật khẩu mới (tối thiểu 6 ký tự)",
        confirmPassLabel: "Xác nhận mật khẩu mới",
        changePassBtn: "Cập nhật mật khẩu",
        resetSuccess: "Thay đổi mật khẩu thành công!",
        loginBtn: "Đăng nhập ngay",
        errorInvalidToken: "Liên kết khôi phục đã hết hạn hoặc không hợp lệ.",
        errorMismatch: "Xác nhận mật khẩu mới không trùng khớp.",
        errorNetwork: "Lỗi kết nối tới máy chủ.",
        errorUpdateFailed: "Cập nhật mật khẩu thất bại."
    },
    en: {
        resetTitle: "Reset Password",
        resetDesc: "Set a new password to access the system",
        validating: "Validating reset token...",
        userLabel: "Account",
        newPassLabel: "New Password (min 6 characters)",
        confirmPassLabel: "Confirm New Password",
        changePassBtn: "Update Password",
        resetSuccess: "Password has been reset successfully!",
        loginBtn: "Log In Now",
        errorInvalidToken: "The password reset link is invalid or has expired.",
        errorMismatch: "Passwords do not match.",
        errorNetwork: "Connection error to the server.",
        errorUpdateFailed: "Failed to update password."
    }
};

let currentLang = localStorage.getItem('nas_lang') || 'vi';
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    document.addEventListener('click', () => {
        document.getElementById('langDropdown').classList.remove('show');
    });
    validateToken();
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

    // Update language switcher UI
    const flag = currentLang === 'vi' ? '🇻🇳' : '🇬🇧';
    document.getElementById('currentLangIcon').textContent = flag;
    document.getElementById('currentLangText').textContent = currentLang.toUpperCase();
    document.title = i18n[currentLang].resetTitle;
}

async function validateToken() {
    const loadingBox = document.getElementById('loadingBox');
    const errorAlert = document.getElementById('errorAlert');
    const errorText = document.getElementById('errorText');
    const resetForm = document.getElementById('resetForm');

    if (!token) {
        loadingBox.style.display = 'none';
        errorText.textContent = i18n[currentLang].errorInvalidToken;
        errorAlert.classList.add('show');
        return;
    }

    try {
        const res = await fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`);
        loadingBox.style.display = 'none';
        
        if (res.ok) {
            const data = await res.json();
            document.getElementById('usernameText').textContent = data.username;
            resetForm.style.display = 'block';
        } else {
            errorText.textContent = i18n[currentLang].errorInvalidToken;
            errorAlert.classList.add('show');
        }
    } catch (err) {
        loadingBox.style.display = 'none';
        errorText.textContent = i18n[currentLang].errorNetwork;
        errorAlert.classList.add('show');
    }
}

async function handleReset(e) {
    e.preventDefault();
    const errorAlert = document.getElementById('errorAlert');
    const errorText = document.getElementById('errorText');
    errorAlert.classList.remove('show');

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        errorText.textContent = i18n[currentLang].errorMismatch;
        errorAlert.classList.add('show');
        return;
    }

    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });

        if (res.ok) {
            document.getElementById('resetForm').style.display = 'none';
            document.getElementById('successBox').style.display = 'flex';
            document.getElementById('resetSub').style.display = 'none';
        } else {
            const err = await res.json().catch(() => ({}));
            errorText.textContent = err.error || i18n[currentLang].errorUpdateFailed;
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
