# The image every user "space" container runs. Baked-in marimo + pandas so
# the app never has to install anything at runtime -- clicking "Update" in
# settings just re-pulls this image and recreates the container. The
# notebook code and SQLite database live on the space's volume, not here.
FROM python:3.12-slim-bookworm

RUN pip install --no-cache-dir marimo pandas

WORKDIR /opt/pacuare
COPY bootstrap.py default_notebook.py ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

VOLUME /data
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
