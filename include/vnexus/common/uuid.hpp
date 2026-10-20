#pragma once

#include <array>
#include <string>
#include <string_view>
#include <optional>
#include <cstdint>

namespace vnexus {

class UUID {
public:
    using Bytes = std::array<uint8_t, 16>;

    UUID() = default;
    explicit UUID(const Bytes& bytes) : bytes_(bytes) {}

    static std::optional<UUID> from_string(std::string_view str);
    static UUID generate_random();

    [[nodiscard]] const Bytes& bytes() const noexcept { return bytes_; }
    [[nodiscard]] std::string to_string() const;

    bool operator==(const UUID& other) const noexcept { return bytes_ == other.bytes_; }
    bool operator!=(const UUID& other) const noexcept { return bytes_ != other.bytes_; }

private:
    Bytes bytes_{};
};

} // namespace vnexus
