-- readingstatus_spec.lua — contract for library/readingstatus.lua
require("spec_helper")
local RS = require("library.readingstatus")

-- A "now" clearly larger than any KOReader summary.modified ms used below,
-- so bootstrap stamps are unambiguous in assertions.
local NOW = 9000000000000

describe("readingstatus mapping (decisive-only)", function()
  it("maps UniversalBooks -> KOReader (push targets)", function()
    assert.are.equal("complete", RS.universalbooks_to_ko("finished"))
    assert.are.equal("abandoned", RS.universalbooks_to_ko("abandoned"))
    assert.is_nil(RS.universalbooks_to_ko("unread")) -- clear -> "New"
    assert.is_nil(RS.universalbooks_to_ko("reading")) -- non-decisive, never pushed
    assert.is_nil(RS.universalbooks_to_ko(nil)) -- undefined
  end)

  it("maps KOReader -> UniversalBooks only for decisive statuses", function()
    assert.are.equal("finished", RS.ko_to_universalbooks("complete"))
    assert.are.equal("abandoned", RS.ko_to_universalbooks("abandoned"))
    assert.is_nil(RS.ko_to_universalbooks("reading")) -- auto-set on open: NOT captured
    assert.is_nil(RS.ko_to_universalbooks("New"))
    assert.is_nil(RS.ko_to_universalbooks(nil))
  end)

  it("knows which UniversalBooks statuses are decisive", function()
    assert.is_true(RS.universalbooks_decisive("finished"))
    assert.is_true(RS.universalbooks_decisive("abandoned"))
    assert.is_true(RS.universalbooks_decisive("unread"))
    assert.is_false(RS.universalbooks_decisive("reading"))
    assert.is_false(RS.universalbooks_decisive(nil))
  end)

  it("parses summary.modified to day ms", function()
    assert.are.equal(os.time({ year = 2026, month = 6, day = 18, hour = 0, min = 0, sec = 0 }) * 1000,
      RS.parse_modified_ms("2026-06-18"))
    assert.is_nil(RS.parse_modified_ms(nil))
    assert.is_nil(RS.parse_modified_ms("garbage"))
  end)
end)

describe("readingstatus reconcile — non-decisive", function()
  it("does nothing when neither side has a decisive status", function()
    local r = RS.reconcile({ reading_status = nil, reading_status_updated_at = 0 },
                           { status = nil, ts = 0 }, NOW)
    assert.is_false(r.write_ko)
    assert.is_false(r.write_store)
  end)

  it("ignores KOReader auto-'reading' against an undefined UniversalBooks book (reported case 2)", function()
    local r = RS.reconcile({ reading_status = nil, reading_status_updated_at = 0 },
                           { status = "reading", ts = 1000 }, NOW)
    assert.is_false(r.write_ko)
    assert.is_false(r.write_store)
  end)
end)

describe("readingstatus reconcile — only one side decisive", function()
  it("pushes a bootstrap UniversalBooks 'finished' down to an opened KO book + stamps (reported case 1)", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 0 },
                           { status = "reading", ts = 1000 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("complete", r.ko_status)
    assert.is_true(r.write_store)
    assert.are.equal("finished", r.universalbooks_status)
    assert.are.equal(NOW, r.ts) -- bootstrap stamp
  end)

  it("pushes a steady UniversalBooks 'finished' down without re-stamping the store", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 500 },
                           { status = "reading", ts = 1000 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("complete", r.ko_status)
    assert.is_false(r.write_store) -- already finished@500
    assert.are.equal(500, r.ts)
  end)

  it("captures a KO 'complete' into an undefined UniversalBooks book at the KO timestamp", function()
    local r = RS.reconcile({ reading_status = nil, reading_status_updated_at = 0 },
                           { status = "complete", ts = 300 }, NOW)
    assert.is_false(r.write_ko)
    assert.is_true(r.write_store)
    assert.are.equal("finished", r.universalbooks_status)
    assert.are.equal(300, r.ts)
  end)

  it("captures a KO 'abandoned' even when UniversalBooks is in non-decisive 'reading'", function()
    local r = RS.reconcile({ reading_status = "reading", reading_status_updated_at = 100 },
                           { status = "abandoned", ts = 300 }, NOW)
    assert.is_true(r.write_store)
    assert.are.equal("abandoned", r.universalbooks_status)
    assert.are.equal(300, r.ts)
  end)
end)

describe("readingstatus reconcile — both decisive", function()
  it("is a no-op in steady state when both already agree", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 500 },
                           { status = "complete", ts = 300 }, NOW)
    assert.is_false(r.write_ko)
    assert.is_false(r.write_store)
  end)

  it("stamps a bootstrap book even when both already agree (exit bootstrap)", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 0 },
                           { status = "complete", ts = 300 }, NOW)
    assert.is_false(r.write_ko)
    assert.is_true(r.write_store)
    assert.are.equal("finished", r.universalbooks_status)
    assert.are.equal(NOW, r.ts)
  end)

  it("bootstrap conflict: UniversalBooks is authoritative (finished beats KO on-hold)", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 0 },
                           { status = "abandoned", ts = 300 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("complete", r.ko_status) -- KO pulled to finished
    assert.is_true(r.write_store)
    assert.are.equal("finished", r.universalbooks_status)
    assert.are.equal(NOW, r.ts)
  end)

  it("steady conflict: UniversalBooks wins when its status timestamp is newer", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 500 },
                           { status = "abandoned", ts = 300 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("complete", r.ko_status)
    assert.is_false(r.write_store)
    assert.are.equal("finished", r.universalbooks_status)
  end)

  it("steady conflict: KOReader wins when the sidecar change is newer", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 300 },
                           { status = "abandoned", ts = 500 }, NOW)
    assert.is_false(r.write_ko) -- KO already abandoned
    assert.is_true(r.write_store)
    assert.are.equal("abandoned", r.universalbooks_status)
    assert.are.equal(500, r.ts)
  end)

  it("bootstrap: a UniversalBooks 'unread' reset clears a KO 'complete' (UniversalBooks authoritative)", function()
    local r = RS.reconcile({ reading_status = "unread", reading_status_updated_at = 0 },
                           { status = "complete", ts = 300 }, NOW)
    assert.is_true(r.write_ko)
    assert.is_nil(r.ko_status) -- clear -> "New"
    assert.is_true(r.write_store)
    assert.are.equal("unread", r.universalbooks_status)
    assert.are.equal(NOW, r.ts)
  end)
end)

describe("readingstatus reconcile — remaining transfer-graph cells", function()
  it("unread × reading: pushes a clear to KO + stamps", function()
    local r = RS.reconcile({ reading_status = "unread", reading_status_updated_at = 0 },
                           { status = "reading", ts = 1000 }, NOW)
    assert.is_true(r.write_ko)
    assert.is_nil(r.ko_status) -- clear -> "New"
    assert.is_true(r.write_store)
    assert.are.equal("unread", r.universalbooks_status)
    assert.are.equal(NOW, r.ts)
  end)

  it("abandoned × reading: pushes 'abandoned' down to KO + stamps", function()
    local r = RS.reconcile({ reading_status = "abandoned", reading_status_updated_at = 0 },
                           { status = "reading", ts = 1000 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("abandoned", r.ko_status)
    assert.is_true(r.write_store)
    assert.are.equal("abandoned", r.universalbooks_status)
  end)

  it("abandoned × complete (bootstrap conflict): UniversalBooks 'abandoned' wins, KO pulled to abandoned", function()
    local r = RS.reconcile({ reading_status = "abandoned", reading_status_updated_at = 0 },
                           { status = "complete", ts = 300 }, NOW)
    assert.is_true(r.write_ko)
    assert.are.equal("abandoned", r.ko_status)
    assert.is_true(r.write_store)
    assert.are.equal("abandoned", r.universalbooks_status)
    assert.are.equal(NOW, r.ts)
  end)
end)

describe("readingstatus reconcile — convergence (no ping-pong)", function()
  it("converges after a capture", function()
    local r = RS.reconcile({ reading_status = nil, reading_status_updated_at = 0 },
                           { status = "complete", ts = 300 }, NOW)
    -- equalize: store now holds the captured status; KO already had it
    local r2 = RS.reconcile({ reading_status = r.universalbooks_status, reading_status_updated_at = r.ts },
                            { status = "complete", ts = 300 }, NOW)
    assert.is_false(r2.write_ko)
    assert.is_false(r2.write_store)
  end)

  it("converges after a bootstrap push", function()
    local r = RS.reconcile({ reading_status = "finished", reading_status_updated_at = 0 },
                           { status = "reading", ts = 1000 }, NOW)
    -- equalize: store stamped to NOW; KO sidecar written to r.ko_status
    local r2 = RS.reconcile({ reading_status = r.universalbooks_status, reading_status_updated_at = r.ts },
                            { status = r.ko_status, ts = 1000 }, NOW)
    assert.is_false(r2.write_ko)
    assert.is_false(r2.write_store)
  end)
end)
