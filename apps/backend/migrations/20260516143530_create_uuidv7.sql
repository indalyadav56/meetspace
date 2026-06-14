-- +goose Up
CREATE OR REPLACE FUNCTION uuidv7() RETURNS UUID AS $$
DECLARE
  v_unix_ms BIGINT;
  v_rand_a  BIGINT;
  v_rand_b  BIGINT;
  v_hex     TEXT;
BEGIN
  v_unix_ms := TRUNC(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  v_rand_a  := TRUNC(RANDOM() * x'FFF'::BIGINT)::BIGINT;
  v_rand_b  := TRUNC(RANDOM() * x'3FFFFFFFFFFFFFFF'::BIGINT)::BIGINT;

  v_hex :=
    LPAD(TO_HEX(v_unix_ms), 12, '0') ||
    LPAD(TO_HEX(7 * x'1000'::BIGINT | v_rand_a), 4, '0') ||
    LPAD(TO_HEX(x'8000000000000000'::BIGINT | v_rand_b), 16, '0');

  RETURN CAST(
    SUBSTRING(v_hex,  1, 8) || '-' ||
    SUBSTRING(v_hex,  9, 4) || '-' ||
    SUBSTRING(v_hex, 13, 4) || '-' ||
    SUBSTRING(v_hex, 17, 4) || '-' ||
    SUBSTRING(v_hex, 21, 12) AS UUID
  );
END;
$$ LANGUAGE plpgsql;

-- +goose Down
DROP FUNCTION IF EXISTS uuidv7();
