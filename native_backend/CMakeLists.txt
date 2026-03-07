cmake_minimum_required(VERSION 3.10)
project(native_backend VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(native_backend SHARED src/backend.cpp)
target_include_directories(native_backend PRIVATE include)

# Flutter desktop applications often require shared libraries to be in a specific output path
# For now, this is a basic script. We will integrate it with Flutter's build system later.
