cmake_minimum_required(VERSION 3.20)
project(vnexusCLI)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SOURCES 
    src/main.cpp
    src/cli.cpp
)

include_directories(include)
set(HEADERS # this one is completely optional btw since we have "include_directories(include)" above.
    include/cli.hpp
)

add_executable(vnexusCLI ${SOURCES})