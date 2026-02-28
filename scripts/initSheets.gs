// scripts/setupAdmin.gs
// รันครั้งเดียวใน GAS console เพื่อสร้าง superadmin คนแรก

function setupFirstAdmin() {
  const userId = 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // ใส่ LINE userId ของคุณ
  const displayName = 'Super Admin';

  // สร้าง admin record
  const existing = SheetHelper.findOneRow('Admin_Users', r => r.userId === userId);
  if (existing) {
    console.log('Admin already exists:', JSON.stringify(existing));
    return;
  }

  SheetHelper.appendRow('Admin_Users', {
    adminId: Utilities.getUuid(),
    userId,
    displayName,
    role: 'superadmin',
    allowedEvents: '',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system'
  });

  // Generate token สำหรับ login
  const token = AdminService.generateAdminToken(userId);
  console.log('✅ Admin created');
  console.log('userId:', userId);
  console.log('adminToken:', token);
  console.log('⚠️ เก็บ token นี้ไว้ใน frontend config อย่างปลอดภัย');
}
