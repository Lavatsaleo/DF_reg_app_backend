# Digital Futures: pull data into R / RStudio through the read-only data API.
#
# One-time setup
#   1. Ask a super admin for an API key (Application dashboard > "API access for R").
#   2. In RStudio run  usethis::edit_r_environ()  (or open ~/.Renviron) and add two lines:
#        DF_API_URL=https://your-digital-futures-site.org
#        DF_API_KEY=dfk_paste_your_key_here
#      Save, then restart R (Session > Restart R).
#   3. install.packages(c("httr2", "jsonlite"))
#
# Never paste the key into a script, a shared project or a chat. Keep it in .Renviron only.
#
# Usage
#   source("digital_futures_data.R")
#   df_whoami()                                   # what this key can see
#   applicants <- df_get("applicants")            # all rows, every page
#   kenya      <- df_get("applicants", country = "Kenya")
#   recent     <- df_get("applicants", updated_since = "2026-11-01")
#   history    <- df_get("status-history")
#   tests      <- df_get("skills-tests")
#   reviews    <- df_get("committee-reviews")
#   all        <- df_get_all()                    # named list with all four datasets
#
# Join datasets on applicantId, for example:
#   merge(applicants, tests, by.x = "id", by.y = "applicantId", all.x = TRUE)

library(httr2)
library(jsonlite)

DF_DATASETS <- c("applicants", "status-history", "skills-tests", "committee-reviews")

df_config <- function() {
  url <- sub("/+$", "", Sys.getenv("DF_API_URL"))
  key <- Sys.getenv("DF_API_KEY")
  if (!nzchar(url)) stop("DF_API_URL is not set. Add it to ~/.Renviron and restart R.", call. = FALSE)
  if (!nzchar(key)) stop("DF_API_KEY is not set. Add it to ~/.Renviron and restart R.", call. = FALSE)
  list(url = url, key = key)
}

df_request <- function(path, query = list()) {
  cfg <- df_config()
  query <- Filter(Negate(is.null), query)

  req <- request(paste0(cfg$url, "/api/data/v1", path))
  req <- req_url_query(req, !!!query)
  req <- req_auth_bearer_token(req, cfg$key)
  req <- req_user_agent(req, "DigitalFutures-R-client/1.0")
  req <- req_timeout(req, 120)
  # Waits and retries when the server says too many requests (429) or is briefly unavailable.
  req <- req_retry(req, max_tries = 4, is_transient = function(resp) resp_status(resp) %in% c(429, 502, 503))
  req <- req_error(req, body = function(resp) {
    msg <- tryCatch(resp_body_json(resp)$message, error = function(e) NULL)
    if (is.null(msg)) resp_status_desc(resp) else msg
  })

  resp <- req_perform(req)
  fromJSON(resp_body_string(resp), simplifyVector = TRUE)
}

# What the key gives access to: name, country, personal data, expiry, datasets.
df_whoami <- function() {
  info <- df_request("")
  cat("Key:            ", info$key$name, "\n")
  cat("Country:        ", info$key$country, "\n")
  cat("Personal data:  ", if (isTRUE(info$key$includesPersonalData)) "yes" else "no (de-identified)", "\n")
  cat("Expires:        ", info$key$expiresAt, "\n")
  cat("Datasets:       ", paste(info$datasets$name, collapse = ", "), "\n")
  invisible(info)
}

# Columns ending in "At" (createdAt, submittedAt, ...) become date-times; dateOfBirth becomes a Date.
df_parse_dates <- function(data) {
  for (col in grep("At$", names(data), value = TRUE)) {
    data[[col]] <- as.POSIXct(data[[col]], format = "%Y-%m-%dT%H:%M:%OS", tz = "UTC")
  }
  if ("dateOfBirth" %in% names(data)) data$dateOfBirth <- as.Date(substr(data$dateOfBirth, 1, 10))
  data
}

# Downloads every page of one dataset and returns a single data frame.
df_get <- function(dataset = DF_DATASETS, country = NULL, updated_since = NULL, page_size = 5000, quiet = FALSE) {
  dataset <- match.arg(dataset)
  if (!is.null(updated_since)) updated_since <- format(as.POSIXct(updated_since, tz = "UTC"), "%Y-%m-%dT%H:%M:%SZ")

  pages <- list()
  page <- 1
  repeat {
    res <- df_request(paste0("/", dataset), list(
      page = page, pageSize = page_size, country = country, updatedSince = updated_since
    ))
    if (length(res$data) > 0) pages[[length(pages) + 1]] <- as.data.frame(res$data, stringsAsFactors = FALSE)
    if (!quiet) message(sprintf("%s: %d of %d rows", dataset, min(page * page_size, res$total), res$total))
    if (!isTRUE(res$hasMore)) break
    page <- page + 1
  }

  if (length(pages) == 0) return(data.frame())
  # Pages can differ only if a column is entirely empty on one page, so fill gaps before binding.
  all_cols <- unique(unlist(lapply(pages, names)))
  pages <- lapply(pages, function(p) {
    for (col in setdiff(all_cols, names(p))) p[[col]] <- NA
    p[all_cols]
  })
  df_parse_dates(do.call(rbind, pages))
}

# All four datasets in a named list.
df_get_all <- function(country = NULL, updated_since = NULL) {
  out <- lapply(DF_DATASETS, function(ds) df_get(ds, country = country, updated_since = updated_since))
  names(out) <- gsub("-", "_", DF_DATASETS)
  out
}
