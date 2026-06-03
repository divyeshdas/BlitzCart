-- KEYS[1] = inventory key  e.g. inventory:{saleId}:{productId}
-- ARGV[1] = quantity requested
local current = redis.call('GET', KEYS[1])
if current == false then
  return -2  -- key missing: sale not active or not found
end
local stock = tonumber(current)
if stock < tonumber(ARGV[1]) then
  return -1  -- sold out
end
return redis.call('DECRBY', KEYS[1], ARGV[1])
-- returns remaining stock (>= 0) on success
