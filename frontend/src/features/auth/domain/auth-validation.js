export function validateCredentials(input) {
  const errors = {};
  const email = input.email.trim();
  if (!email) errors.email = "Vui lòng nhập email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Email chưa đúng định dạng.";
  if (!input.password) errors.password = "Vui lòng nhập mật khẩu.";
  return errors;
}

export function validateRegistration(input) {
  const errors = validateCredentials(input);
  const fullName = input.fullName.trim();
  if (!fullName) errors.fullName = "Vui lòng nhập họ và tên.";
  else if (fullName.length < 2 || fullName.length > 120) errors.fullName = "Họ và tên phải từ 2 đến 120 ký tự.";
  if (!input.phone.trim()) errors.phone = "Vui lòng nhập số điện thoại.";
  else if (!/^(?:\+84|0)\d{9,10}$/.test(input.phone.trim())) errors.phone = "Số điện thoại Việt Nam chưa hợp lệ.";
  if (input.password && (input.password.length < 8 || input.password.length > 72)) errors.password = "Mật khẩu phải từ 8 đến 72 ký tự.";
  else if (input.password && !/[a-z]/.test(input.password)) errors.password = "Mật khẩu cần có chữ thường.";
  else if (input.password && !/[A-Z]/.test(input.password)) errors.password = "Mật khẩu cần có chữ hoa.";
  else if (input.password && !/\d/.test(input.password)) errors.password = "Mật khẩu cần có chữ số.";
  if (!input.confirmPassword) errors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
  else if (input.password !== input.confirmPassword) errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  return errors;
}
