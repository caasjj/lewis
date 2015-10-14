--[[

  Set a key to the given value

]]--

local lockKey         = KEYS[1]
local lockValue       = ARGV[1]

-- Max ttl is 90 seconds
return redis.call('set', lockKey, lockValue)

