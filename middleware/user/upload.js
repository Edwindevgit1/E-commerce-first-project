import multer from "multer";

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new Error("This file can't be added. Only JPG and PNG images are allowed.");
  error.code = "INVALID_FILE_TYPE";
  cb(error, false);
};

const upload = multer({
  storage,
  fileFilter
});

export default upload;
