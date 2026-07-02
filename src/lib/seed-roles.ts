import { db } from '@/lib/db';
import { ADMIN_PERMISSIONS, EMPLOYEE_PERMISSIONS, serializePermissions } from '@/lib/permissions';

let seeded = false;

export async function ensureRolesSeeded() {
  if (seeded) return;
  
  try {
    const roleCount = await db.role.count();
    if (roleCount > 0) {
      seeded = true;
      return;
    }

    // Create default roles
    const adminRole = await db.role.create({
      data: {
        name: 'Administrateur',
        permissions: serializePermissions(ADMIN_PERMISSIONS),
        isSystem: true,
      },
    });

    const employeeRole = await db.role.create({
      data: {
        name: 'Employé',
        permissions: serializePermissions(EMPLOYEE_PERMISSIONS),
        isSystem: true,
      },
    });

    // Migrate existing users based on their old role field
    const adminUsers = await db.user.findMany({
      where: { role: 'ADMIN', roleId: null },
    });

    const employeeUsers = await db.user.findMany({
      where: { role: 'EMPLOYEE', roleId: null },
    });

    for (const user of adminUsers) {
      await db.user.update({
        where: { id: user.id },
        data: { roleId: adminRole.id },
      });
    }

    for (const user of employeeUsers) {
      await db.user.update({
        where: { id: user.id },
        data: { roleId: employeeRole.id },
      });
    }

    // Also handle any users with null roleId (edge case)
    const unassignedUsers = await db.user.findMany({
      where: { roleId: null },
    });

    for (const user of unassignedUsers) {
      await db.user.update({
        where: { id: user.id },
        data: { roleId: employeeRole.id },
      });
    }

    seeded = true;
  } catch (error) {
    console.error('Failed to seed roles:', error);
    seeded = true; // Don't retry on every request
  }
}