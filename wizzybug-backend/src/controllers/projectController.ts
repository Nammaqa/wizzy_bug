import { Response } from 'express';
import Project from '../models/Project';
import Ticket from '../models/Ticket';
import { AuthRequest } from '../middleware/authMiddleware';

const makeKey = (name: string): string => {
  const letters = name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean);
  if (letters.length === 1) return letters[0].slice(0, 4).toUpperCase();
  return letters.map(w => w[0]).join('').slice(0, 4).toUpperCase();
};

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find().populate('members', 'name email').sort({ createdAt: -1 });

    // Attach a live open-bug count per project so the sidebar can show it without
    // an extra round trip per project.
    const counts = await Ticket.aggregate([
      { $match: { status: { $ne: 'closed' } } },
      { $group: { _id: '$project', count: { $sum: 1 } } }
    ]);
    const countMap: Record<string, number> = {};
    counts.forEach(c => { countMap[String(c._id)] = c.count; });

    const withCounts = projects.map(p => ({
      ...p.toObject(),
      openBugCount: countMap[String(p._id)] || 0
    }));

    res.json(withCounts);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, members, key } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Project name is required' });
      return;
    }

    const existing = await Project.findOne({ name: name.trim() });
    if (existing) {
      res.status(400).json({ message: 'A project with this name already exists' });
      return;
    }

    // Default members to creator if not provided
    const projectMembers = members || (req.user ? [req.user._id] : []);

    const project = await Project.create({
      name: name.trim(),
      key: (key && key.trim()) ? key.trim().toUpperCase() : makeKey(name.trim()),
      description,
      members: projectMembers,
      createdBy: req.user?._id
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id).populate('members', 'name email');
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body;
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { description: typeof description === 'string' ? description.trim() : '' },
      { new: true, runValidators: true }
    ).populate('members', 'name email');

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    await Ticket.deleteMany({ project: req.params.id });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
