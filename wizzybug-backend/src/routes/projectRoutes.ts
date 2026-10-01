import express from 'express';
import { getProjects, createProject, getProjectById, updateProject, deleteProject } from '../controllers/projectController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, getProjects)
  // Only admins can create new projects; everyone can still see them.
  .post(protect, adminOnly, createProject);

router.route('/:id')
  .get(protect, getProjectById)
  .put(protect, adminOnly, updateProject)
  .delete(protect, adminOnly, deleteProject);

export default router;
