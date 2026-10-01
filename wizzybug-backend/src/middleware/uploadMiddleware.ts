import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();
const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
  },
});

export const optionalUpload = (req: Request, res: Response, next: NextFunction): void => {
  const contentType = req.headers['content-type'] as string | undefined;
  if (contentType && contentType.includes('multipart/form-data')) {
    upload.fields([
      { name: 'images', maxCount: 10 },
      { name: 'image', maxCount: 1 },
    ])(req, res, (error) => {
      if (error) {
        const isFileTooLarge =
          error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        res.status(isFileTooLarge ? 413 : 400).json({
          message: isFileTooLarge
            ? 'Each attachment must be 50 MB or smaller.'
            : 'Could not read the uploaded attachment.',
        });
        return;
      }
      next();
    });
    return;
  }
  next();
};

export const requiredUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('image')(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'An attachment is required' });
      return;
    }

    next();
  });
};
