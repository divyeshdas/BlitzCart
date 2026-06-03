-- KEYS[1] = rate limit key  e.g. ratelimit:{userId}
-- ARGV[1] = max tokens
-- ARGV[2] = window seconds
local tokens = redis.call('GET', KEYS[1])
if tokens == false then
  redis.call('SET', KEYS[1], tonumber(ARGV[1]) - 1, 'EX', tonumber(ARGV[2]))
  return 1  -- first request in window, allowed
end
if tonumber(tokens) <= 0 then
  return 0  -- bucket empty, blocked
end
redis.call('DECR', KEYS[1])
return 1  -- allowed
