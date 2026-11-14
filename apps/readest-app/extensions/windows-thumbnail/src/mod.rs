//! Windows Thumbnail Provider for Universal Books
//!
//! This module provides Windows Explorer thumbnail support for eBook files.
//! Thumbnails are only shown when Universal Books is set as the default application.
//!
//! Supported formats: EPUB, MOBI, AZW, AZW3, KF8, FB2, CBZ, CBR, PDF

#![allow(non_snake_case)]

mod com_provider;
mod extraction;
mod pdf;
mod preview;

pub use extraction::*;
