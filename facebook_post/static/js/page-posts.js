$(document).ready(function() {
    $('#top_posts_view').hide()
    function plot_graph() { // function to plot the graph. Uses highcharts graph
        var posts_view = {}; // map for storing number of views grouped by month year.
        var post_count = {}; // map for storing number of posts grouped by month year

        $('#posts tbody tr').each(function() { // iterate over each row
            var columns = $(this).find("td");
            if(columns[3].innerHTML=='UnPublished') // skip unpublished messages
                return;

            var date = new Date(columns[1].innerHTML); // convert to date object

            var month = parseInt(date.getMonth());
            //var cdate = parseInt(date.getDate())+1; // find the date. no longer used in current implementation
            var month_year = date.getFullYear() + ',' + month; // set key as "year,month"

            if (month_year in posts_view) {
                posts_view[month_year] += parseInt(columns[2].innerHTML);
                post_count[month_year] += 1;
            }
            else {
                posts_view[month_year] = parseInt(columns[2].innerHTML);
                post_count[month_year] = 1;
            }
        });
        post_view_list = [];
        post_count_list = [];

        for(var entry in posts_view){
            var parts = entry.split(',');
            var utcDate = Date.UTC(parseInt(parts[0]), parseInt(parts[1]),1); // get utc date which acts as X axis
            post_view_list.push([utcDate, posts_view[entry]/post_count[entry]]); // Y axis - average number of views
            post_count_list.push([utcDate, post_count[entry]]); // Y-axis - number of posts
        }




        Highcharts.chart('graph_container', {
            chart: {
                type: 'spline'
            },
            title: {
                text: 'Post Metrics'
            },

            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    month: '%b, %Y',

                },
                title: {
                    text: 'Creation Month'
                }
            },
            yAxis: {
                title: {
                    text: ''
                },
                min: 0
            },
            tooltip: {
                headerFormat: '<b>{series.name}</b><br>',
                pointFormat: '{point.x:%b, %Y}: {point.y:.2f} '
            },

            plotOptions: {
                spline: {
                    marker: {
                        enabled: true
                    }
                }
            },

            series: [{
                name: 'Average Number of Views',
                data: post_view_list // set data for graph(created above)
            },  {
                name: 'Number of Posts',
                data: post_count_list // set data for graph (created above)
            }]
        });

    }

    function sort_arr(o1,o2) {
        // function to sort the posts in descending order. Each input object has the format [message, impressions]
        // and we sort in descending order.
        if(o1[1] >o2[1])
            return -1;

        if(o1[1]< o2[1])
            return 1;
        return 0;
    }

    function find_top_posts(){
        // placeholder to keep posts and impressions. Is a list of lists where each inner list has the format
        // [message, number of impressions]
        var arr = [];
        $('#posts tbody tr').each(function() { // iterate over all the rows
            var columns = $(this).find("td");
            if(columns[3].innerHTML=='UnPublished') // skip the unpublished messages
                return;
            var temp = [];
            temp.push(columns[0].innerHTML); // add message to inner list
            temp.push(parseInt(columns[2].innerHTML)); // add impressions to inner list
            arr.push(temp); // add inner list to outer list
        });
        arr.sort(sort_arr); // sort the list using sort_arr as the sort function.

        // create html to show the top 5 posts.
        var top_post_html = '<b> Top most viewed posts</b> <br/>';
        top_post_html+='<table style="width: auto;" class="table table-striped table-bordered table-condensed"  cellspacing="0"><tr><th>Post</th><th>Views</th></tr>';
        var len = 5;
        if (arr.length < len){
            len = arr.length;
        }
        for(var i=0; i<len; i++){
            top_post_html+='<tr><td>';
            if(arr[i][0].length > 150) // restrict the size of message to be shown to 150 characters only
                top_post_html+=arr[i][0].substring(0,150)+'...</td>';
            else
                top_post_html+=arr[i][0]+'</td>';
            top_post_html+='<td>'+arr[i][1]+'</td></tr>';

        }
        top_post_html+="</table>";
        $('#top_post').html(top_post_html); // set the html to the div named "top_post"
        $('#top_posts_view').slideDown(1000,function () { // show the div named "top_post_views"

        });


    }

    function get_postimpressions() { // function to get the impressions for all the posts
        var count = 0; // counter for ajax calls
        // get the total number of calls that need to be made by searching for number of hidden fields.
         // this helps in determining when all the calls are complete
        var max_row_count = $('#posts tbody').find("td input[name='post_id']").length;

        $('#posts tbody tr').each(function() { // iterate over each row of the table
            // find the value of hidden field named post_id. This represents the post id
            var post_id_val = $(this).find("td input[name='post_id']").val();

            if(post_id_val == undefined) // the current row has already been processed and impressions are present
                return;
            var columns = $(this).find("td");

            $.ajax({
                  url: "/page-insights/get-post-impressions/", // url to get the post impressions
                  type: "get", //send it through get method
                  data: {
                    post_id:post_id_val, // params to be passed to the view as GET parameter.
                  },
                  success: function(response) { // success function
                      columns[2].innerHTML = response.impressions; // update the impression column
                      count++;
                      if(count == max_row_count){ // all the ajax calls are complete.
                          find_top_posts(); // find top posts
                          plot_graph(); // plot the graph
                      }

                  },
                  error: function(xhr) {
                    console.log("error");
                  }
            });
        });
    }


    // make the table with id "posts" as a datatable with infinite scroll.
    var dataTable =   $("#posts").dataTable({
        "bInfo": false,
        "bScrollInfinite": true, // set scroll infinite to true
        "bScrollCollapse": true,
        "sScrollY": "300px", // heifht of datatbel
        "bProcessing": true,
        "bServerSide": true, // set serverside to true so that this uses an api call to get the next set of rows
        "sAjaxSource": "/page-insights/get-page-posts/", //  url to call to get the next rows
        "bFilter": false,
        "bSort": false, // disable sorting
        "fnServerParams": function ( aoData ) { // additional GET params to be passed to the view for processing
         // these are taken from the html page
            aoData.push( { "name": "page_id", "value":  $('#page-id').val() } );
            aoData.push( { "name": "next_url", "value": $('#next_url').val() } );
            aoData.push( { "name": "unpublished_next_url", "value": $('#unpublished_url').val() } );
            aoData.push( { "name": "skip_unpublished", "value": $('#skip_unpublished').val() } );

        },
        "fnServerData": function ( sSource, aoData, fnCallback, oSettings ) {
            $.getJSON( sSource, aoData, function (json) { // success function for the call

                //take params from returned json set values of hidden field
                $('#next_url').val(json.next);
                $('#unpublished_url').val(json.unpublished_next);
                $('#skip_unpublished').val(json.skip_unpublished);

                // call the default fallback function which will take the json and create rows based on aaData field of json.
                fnCallback(json);
                // call post impression method to get the impressions for all the posts.
                get_postimpressions();

            } );
        }
        });
});