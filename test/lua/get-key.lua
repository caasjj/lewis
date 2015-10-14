--[[

  Get a key

]]--

local lockKey         = KEYS[1]

-- Max ttl is 90 seconds
return redis.call('get', lockKey)