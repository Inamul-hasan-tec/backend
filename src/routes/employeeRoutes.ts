import { Router } from 'express';
import EmployeeController from '../controllers/EmployeeController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

router.get(
  '/',
  requirePermission(Permission.OPERATIONS_VIEW),
  EmployeeController.getEmployees.bind(EmployeeController)
);

router.post(
  '/',
  requirePermission(Permission.OPERATIONS_MANAGE),
  EmployeeController.createEmployee.bind(EmployeeController)
);

router.put(
  '/:id',
  requirePermission(Permission.OPERATIONS_MANAGE),
  EmployeeController.updateEmployee.bind(EmployeeController)
);

router.get(
  '/assignments/roster',
  requirePermission(Permission.OPERATIONS_VIEW),
  EmployeeController.getAssignments.bind(EmployeeController)
);

router.get(
  '/assignments/conflicts',
  requirePermission(Permission.OPERATIONS_VIEW),
  EmployeeController.getAssignmentConflicts.bind(EmployeeController)
);

router.post(
  '/assignments',
  requirePermission(Permission.OPERATIONS_MANAGE),
  EmployeeController.createAssignment.bind(EmployeeController)
);

router.put(
  '/assignments/:id',
  requirePermission(Permission.OPERATIONS_MANAGE),
  EmployeeController.updateAssignment.bind(EmployeeController)
);

router.put(
  '/assignments/:id/status',
  requirePermission(Permission.OPERATIONS_TASK_UPDATE),
  EmployeeController.updateAssignmentStatus.bind(EmployeeController)
);

router.delete(
  '/assignments/:id',
  requirePermission(Permission.OPERATIONS_MANAGE),
  EmployeeController.deleteAssignment.bind(EmployeeController)
);

export default router;
