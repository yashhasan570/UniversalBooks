require("spec_helper")
require("spec.koreader_stubs")
local UniversalBooksSync = require("main")

describe("UniversalBooks menu ordering", function()
    local names = { "ui/elements/reader_menu_order", "ui/elements/filemanager_menu_order" }
    local saved, orders
    before_each(function()
        saved, orders = {}, {}
        for _, name in ipairs(names) do
            saved[name] = package.loaded[name]
            orders[name] = { tools = { "read_timer", "Storefront", "statistics" } }
            package.loaded[name] = orders[name]
        end
    end)
    after_each(function()
        for _, name in ipairs(names) do package.loaded[name] = saved[name] end
    end)

    it("places UniversalBooks before Storefront in both contexts without duplicate entries", function()
        for _ = 1, 2 do UniversalBooksSync:addToMainMenu({}) end
        for _, name in ipairs(names) do
            assert.same({ "universalbooks_sync", "read_timer", "Storefront", "statistics" }, orders[name].tools)
        end
    end)
end)
