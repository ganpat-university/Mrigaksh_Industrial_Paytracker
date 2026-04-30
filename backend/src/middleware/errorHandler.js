// src/middleware/errorHandler.js
// Global error handler - catches anything thrown in routes

export const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 10MB.' });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field. Use field name: "file"' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};
