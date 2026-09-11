-- Persist only the private Storage object path. The API returns signed URLs.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;

-- The bucket is managed separately and selected with PROFILE_PHOTOS_BUCKET.
