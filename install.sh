#!/bin/bash

# Color codes for clean output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}       NAS Web Manager Auto Installer for Ubuntu   ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Check if run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Vui lòng chạy script với quyền root (sudo). Hoặc sử dụng: sudo ./install.sh${NC}"
  exit 1
fi

# Detect actual user if run with sudo
ACTUAL_USER=$SUDO_USER
if [ -z "$ACTUAL_USER" ]; then
  ACTUAL_USER=$(whoami)
fi

# Get current script directory
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
echo -e "${GREEN}[+] Đường dẫn cài đặt:${NC} $APP_DIR"

# 1. Update system
echo -e "${YELLOW}[*] Cập nhật danh sách gói hệ thống...${NC}"
apt-get update -y

# 2. Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}[*] Không tìm thấy Node.js. Đang tiến hành cài đặt Node.js v20...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  NODE_VER=$(node -v)
  echo -e "${GREEN}[+] Node.js đã được cài đặt:${NC} $NODE_VER"
fi

# 3. Check MySQL
echo -e "${YELLOW}[*] Kiểm tra trạng thái MySQL Server...${NC}"
if ! command -v mysql &> /dev/null; then
  read -p "MySQL Server chưa được cài đặt. Bạn có muốn cài đặt MySQL Server ngay không? (y/n): " install_mysql
  if [[ $install_mysql =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}[*] Đang cài đặt MySQL Server...${NC}"
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
    echo -e "${GREEN}[+] Đã cài đặt và khởi động MySQL Server.${NC}"
  else
    echo -e "${YELLOW}[!] Bỏ qua cài đặt MySQL. Ứng dụng sẽ tự động chuyển sang lưu trữ file JSON nếu không cấu hình MySQL.${NC}"
  fi
else
  echo -e "${GREEN}[+] MySQL đã được cài đặt sẵn trên hệ thống.${NC}"
fi

# 4. Install Node dependencies
echo -e "${YELLOW}[*] Đang cài đặt các thư viện Node.js (npm install)...${NC}"
cd "$APP_DIR"
# Run as the actual user to avoid root ownership issues in node_modules
sudo -u "$ACTUAL_USER" npm install

# 5. Configuration (.env)
if [ ! -f .env ]; then
  echo -e "${YELLOW}[*] Đang tạo file cấu hình .env...${NC}"
  cp .env.example .env
  
  # Prompt for database credentials
  echo -e "${YELLOW}--- Cấu hình thông tin kết nối Cơ sở dữ liệu ---${NC}"
  read -p "Sử dụng MySQL? (true/false) [mặc định: true]: " use_mysql
  use_mysql=${use_mysql:-true}
  
  read -p "MySQL Host [mặc định: 127.0.0.1]: " db_host
  db_host=${db_host:-127.0.0.1}
  
  read -p "MySQL Port [mặc định: 3306]: " db_port
  db_port=${db_port:-3306}
  
  read -p "MySQL User [mặc định: root]: " db_user
  db_user=${db_user:-root}
  
  read -sp "MySQL Password (nhấn Enter nếu không có mật khẩu): " db_password
  echo ""
  
  read -p "MySQL Database Name [mặc định: nas_manager]: " db_name
  db_name=${db_name:-nas_manager}

  read -p "Cổng chạy NAS Web Manager (PORT) [mặc định: 3000]: " app_port
  app_port=${app_port:-3000}

  read -p "Đường dẫn thư mục chứa file NAS (NAS_ROOT) [mặc định: /mnt/nas]: " nas_root
  nas_root=${nas_root:-/mnt/nas}

  # Prompt for SMTP configuration
  echo -e "${YELLOW}--- Cấu hình Gmail SMTP để Khôi phục Mật khẩu ---${NC}"
  read -p "Bạn muốn sử dụng Gmail SMTP để khôi phục mật khẩu? (y/n) [mặc định: n]: " use_gmail_smtp
  if [[ $use_gmail_smtp =~ ^[Yy]$ ]]; then
    smtp_host="smtp.gmail.com"
    smtp_port="587"
    read -p "Địa chỉ Gmail của bạn (ví dụ: user@gmail.com): " smtp_user
    read -sp "Mật khẩu ứng dụng Gmail (App Password): " smtp_pass
    echo ""
    read -p "Email người gửi (FROM) [mặc định: $smtp_user]: " smtp_from
    smtp_from=${smtp_from:-$smtp_user}
  else
    smtp_host=""
    smtp_port=""
    smtp_user=""
    smtp_pass=""
    smtp_from=""
  fi

  # Write variables to .env
  cat <<EOT > .env
PORT=$app_port
NAS_ROOT=$nas_root
SESSION_SECRET=$(openssl rand -hex 16 2>/dev/null || echo "nas_secure_secret_$(date +%s)")

USE_MYSQL=$use_mysql
DB_HOST=$db_host
DB_PORT=$db_port
DB_USER=$db_user
DB_PASSWORD=$db_password
DB_NAME=$db_name

SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_USER=$smtp_user
SMTP_PASSWORD=$smtp_pass
SMTP_FROM="$smtp_from"
EOT
  echo -e "${GREEN}[+] Đã lưu cấu hình vào file .env.${NC}"
else
  echo -e "${GREEN}[+] File .env đã tồn tại, bỏ qua bước tạo mới.${NC}"
fi

# Ensure NAS root directory exists
NAS_DIR=$(grep -E "^NAS_ROOT=" .env | cut -d'=' -f2-)
# Remove potential Windows carriage return or quotes
NAS_DIR=$(echo "$NAS_DIR" | tr -d '\r' | tr -d '"' | tr -d "'")
if [ ! -d "$NAS_DIR" ]; then
  echo -e "${YELLOW}[*] Tạo thư mục NAS: $NAS_DIR...${NC}"
  mkdir -p "$NAS_DIR"
  chown -R "$ACTUAL_USER":"$ACTUAL_USER" "$NAS_DIR"
fi

# 6. Setup Systemd Service
echo -e "${YELLOW}[*] Đang đăng ký dịch vụ Systemd (nas-web-manager.service)...${NC}"
SERVICE_FILE="/etc/systemd/system/nas-web-manager.service"
NODE_PATH=$(which node)
NODE_PATH=${NODE_PATH:-/usr/bin/node}

cat <<EOT > "$SERVICE_FILE"
[Unit]
Description=NAS Web File Manager Service
After=network.target mysql.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nas-web-manager
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOT

# Reload systemd and start service
systemctl daemon-reload
systemctl enable nas-web-manager
systemctl start nas-web-manager

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}  Cài đặt thành công NAS Web File Manager!        ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "${BLUE}  - Trạng thái dịch vụ: ${NC}\$(systemctl is-active nas-web-manager)"
echo -e "${BLUE}  - Cổng chạy dịch vụ: ${NC}http://localhost:\$(grep -E "^PORT=" .env | cut -d'=' -f2- | tr -d '\r')"
echo -e "${BLUE}  - Quản lý dịch vụ: ${NC}"
echo -e "    * Xem logs:  ${YELLOW}journalctl -u nas-web-manager -f${NC}"
echo -e "    * Khởi động lại: ${YELLOW}systemctl restart nas-web-manager${NC}"
echo -e "    * Dừng chạy: ${YELLOW}systemctl stop nas-web-manager${NC}"
echo -e "${GREEN}==================================================${NC}"
